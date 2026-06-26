// modules/group-lots/services/group-lot.service.ts · FPO group-lot coordination use-cases.
// One ACID tx per write (UoW), outbox in-tx (Law 4), idempotent create/pledge (Law 3), authz THROWS (Law 6).
// Quantities are float-free (numeric(14,3) → milli-int); the settle computes proportional shares (bigint minor,
// zero-loss). NOTE: settle RECORDS each pledger's proportional share against the sale proceeds — it does NOT move
// money. Actual disbursement runs through the payments/wallet path (a follow-on; flagged in the README).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { uuidv7 } from '../../../core/database/uuid.util';
import { GroupLot } from '../domain/group-lot.entity';
import { DomainEvent } from '../domain/group-lot.events';
import { settleShares, parseQtyMilli } from '../domain/settle';
import { GroupLotRepository } from '../repositories/group-lot.repository';
import { CreateGroupLotDto, PledgeDto, SettleDto } from '../dto/group-lot.dto';
import { GroupLotForbiddenError, GroupLotNotFoundError, EmptyGroupLotError } from '../domain/group-lot.errors';

export interface GroupLotActor { userId: string; canCoordinate: boolean; }

@Injectable()
export class GroupLotService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly audit: AuditWriter,
    private readonly repo: GroupLotRepository,
  ) {}

  private async flush(tx: TxContext, tenantId: string, aggId: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'group_lot', aggregateId: aggId, eventType: e.type, payload: { v: 1, ...e.payload } });
  }

  async create(tenantId: string, actor: GroupLotActor, idemKey: string, dto: CreateGroupLotDto) {
    if (!actor.canCoordinate) throw new GroupLotForbiddenError();
    return this.idem.remember(idemKey, actor.userId, 'group_lot.create', () =>
      timed(this.metrics, 'group_lot.create', { tenant: tenantId }, () =>
        this.uow.run(tenantId, async (tx) => {
          const lot = GroupLot.create({ id: uuidv7(), tenantId, coordinatorUserId: actor.userId, productId: dto.productId,
            targetQuantity: dto.targetQuantity, unitCode: dto.unitCode, pledgeDeadline: dto.pledgeDeadline, coordinationFeeBps: dto.coordinationFeeBps });
          await this.repo.insert(tx, lot);
          await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'group_lot.created', entityType: 'group_lot', entityId: lot.id, newValue: { productId: dto.productId, targetQuantity: dto.targetQuantity } });
          await this.flush(tx, tenantId, lot.id, lot.pullEvents());
          return lot.serialize();
        }, { userId: actor.userId })));
  }

  async list(tenantId: string, actor: GroupLotActor, q: { box: 'mine' | 'all'; status?: string; cursor?: { c: string; id: string }; limit: number }) {
    const coordinatorUserId = q.box === 'mine' ? actor.userId : undefined;
    const rows = await this.repo.listFor(tenantId, { coordinatorUserId, status: q.status, cursor: q.cursor, limit: q.limit });
    const items = rows.map((g) => g.serialize());
    const last = items[items.length - 1];
    const nextCursor = items.length === q.limit && last?.createdAt ? Buffer.from(`${(last.createdAt as Date).toISOString()}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }

  async getById(tenantId: string, id: string) {
    const lot = await this.repo.getById(tenantId, id);
    if (!lot) throw new GroupLotNotFoundError(id);
    const pledges = await this.repo.listPledges(tenantId, id);
    return { ...lot.serialize(), pledges: pledges.map((p) => ({ id: p.id, farmerUserId: p.farmerUserId, quantity: p.quantity, qualityOk: p.qualityOk, settledShareMinor: p.settledShareMinor })) };
  }

  async pledge(tenantId: string, actor: GroupLotActor, idemKey: string, id: string, dto: PledgeDto) {
    if (!actor.canCoordinate) throw new GroupLotForbiddenError();
    return this.idem.remember(idemKey, actor.userId, 'group_lot.pledge', () =>
      timed(this.metrics, 'group_lot.pledge', { tenant: tenantId }, () =>
        this.uow.run(tenantId, async (tx) => {
          const lot = await this.repo.getForUpdate(tx, tenantId, id);
          if (!lot) throw new GroupLotNotFoundError(id);
          lot.applyPledge(parseQtyMilli(dto.quantity), new Date());
          await this.repo.insertPledge(tx, tenantId, { id: uuidv7(), groupLotId: id, farmerUserId: dto.farmerUserId, quantity: dto.quantity });
          await this.repo.update(tx, lot);
          await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'group_lot.pledged', entityType: 'group_lot', entityId: id, newValue: { farmerUserId: dto.farmerUserId, quantity: dto.quantity } });
          await this.flush(tx, tenantId, id, lot.pullEvents());
          return lot.serialize();
        }, { userId: actor.userId })));
  }

  private async transition(tenantId: string, actor: GroupLotActor, id: string, action: string, mutate: (l: GroupLot) => void) {
    if (!actor.canCoordinate) throw new GroupLotForbiddenError();
    return timed(this.metrics, `group_lot.${action}`, { tenant: tenantId }, () =>
      this.uow.run(tenantId, async (tx) => {
        const lot = await this.repo.getForUpdate(tx, tenantId, id);
        if (!lot) throw new GroupLotNotFoundError(id);
        mutate(lot);
        await this.repo.update(tx, lot);
        await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: `group_lot.${action}`, entityType: 'group_lot', entityId: id, newValue: { status: lot.status } });
        await this.flush(tx, tenantId, id, lot.pullEvents());
        return lot.serialize();
      }, { userId: actor.userId }));
  }
  async markReady(tenantId: string, actor: GroupLotActor, id: string) { return this.transition(tenantId, actor, id, 'ready', (l) => l.markReady()); }
  async cancel(tenantId: string, actor: GroupLotActor, id: string) { return this.transition(tenantId, actor, id, 'cancelled', (l) => l.cancel()); }

  /** Record proportional shares from sale proceeds, then flip status to settled. Money is NOT moved here. */
  async settle(tenantId: string, actor: GroupLotActor, id: string, dto: SettleDto) {
    if (!actor.canCoordinate) throw new GroupLotForbiddenError();
    return timed(this.metrics, 'group_lot.settle', { tenant: tenantId }, () =>
      this.uow.run(tenantId, async (tx) => {
        const lot = await this.repo.getForUpdate(tx, tenantId, id);
        if (!lot) throw new GroupLotNotFoundError(id);
        const pledges = await this.repo.listPledgesForUpdate(tx, tenantId, id);
        if (pledges.length === 0) throw new EmptyGroupLotError();
        const result = settleShares({ grossMinor: BigInt(dto.grossProceedsMinor), coordinationFeeBps: lot.coordinationFeeBps,
          pledges: pledges.map((p) => ({ id: p.id, qtyMilli: parseQtyMilli(p.quantity) })) });
        for (const s of result.shares) await this.repo.setSettledShare(tx, tenantId, s.id, s.shareMinor);
        lot.markSettled();
        await this.repo.update(tx, lot);
        await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'group_lot.settled', entityType: 'group_lot', entityId: id,
          newValue: { grossMinor: result.grossMinor.toString(), coordinationFeeMinor: result.coordinationFeeMinor.toString(), netMinor: result.netMinor.toString() } });
        await this.flush(tx, tenantId, id, lot.pullEvents());
        return { ...lot.serialize(), settlement: { grossMinor: result.grossMinor.toString(), coordinationFeeMinor: result.coordinationFeeMinor.toString(), netMinor: result.netMinor.toString(), shares: result.shares.map((s) => ({ pledgeId: s.id, shareMinor: s.shareMinor.toString() })) } };
      }, { userId: actor.userId }));
  }
}
