// modules/requirements/services/requirement.service.ts
// Requirement (demand-post) use-cases. Every write: one ACID tx (UoW), status via the machine
// (Law 5), outbox events in the SAME tx (Law 4), audit on admin/override actions. NO money moves
// here. No version column → mutations lock the row FOR UPDATE.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { uuidv7 } from '../../../core/database/uuid.util';
import { Requirement } from '../domain/requirement.entity';
import { DomainEvent } from '../domain/requirements.events';
import { isAcceptingResponses } from '../domain/requirement.state';
import { RequirementNotFoundError, RequirementForbiddenError } from '../domain/requirements.errors';
import { RequirementRepository } from '../repositories/requirement.repository';
import { CreateRequirementDto } from '../dto/create-requirement.dto';

export interface RequirementActor { userId: string; canModerate: boolean; }

@Injectable()
export class RequirementService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly audit: AuditWriter,
    private readonly repo: RequirementRepository,
  ) {}

  async create(tenantId: string, buyerUserId: string, idemKey: string, dto: CreateRequirementDto) {
    return this.idem.remember(idemKey, buyerUserId, 'requirements.post', () =>
      timed(this.metrics, 'requirements.post', { tenant: tenantId }, async () => {
        const requirement = Requirement.post({
          id: uuidv7(), tenantId, buyerUserId, productId: dto.productId ?? null, categoryId: dto.categoryId ?? null,
          title: dto.title, quantity: dto.quantity, unitCode: dto.unitCode,
          budgetMinMinor: dto.budgetMinMinor ? BigInt(dto.budgetMinMinor) : null, budgetMaxMinor: dto.budgetMaxMinor ? BigInt(dto.budgetMaxMinor) : null,
          currencyCode: dto.currencyCode ?? 'INR', needBy: dto.needBy ? new Date(`${dto.needBy}T00:00:00Z`) : null,
          deliveryPincode: dto.deliveryPincode ?? null, isUrgent: dto.isUrgent ?? false,
        });
        return this.uow.run(tenantId, async (tx) => {
          await this.repo.insert(tx, requirement);
          const p = requirement.toProps();
          await this.flush(tx, tenantId, p.id, requirement.pullEvents());
          return this.serialize(p);
        }, { userId: buyerUserId });
      }));
  }

  /** Buyer withdraws their requirement (or a moderator closes it — audited). */
  async close(tenantId: string, actor: RequirementActor, id: string, ip: string | null) {
    return timed(this.metrics, 'requirements.close', { tenant: tenantId }, () =>
      this.uow.run(tenantId, async (tx) => {
        const r = await this.repo.getForUpdate(tx, tenantId, id);
        if (!r) throw new RequirementNotFoundError(id);
        this.assertBuyerOrModerator(r, actor);
        r.close();
        await this.repo.update(tx, r);
        if (actor.canModerate && r.buyerUserId !== actor.userId) {
          await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'requirement.closed', entityType: 'requirement', entityId: id, newValue: { by: 'moderator' }, ip });
        }
        await this.flush(tx, tenantId, id, r.pullEvents());
        return this.serialize(r.toProps());
      }, { userId: actor.userId }));
  }

  /** Worker job: lapse a requirement past need_by. Idempotent (skips non-accepting). */
  async expire(tenantId: string, id: string): Promise<void> {
    await this.uow.run(tenantId, async (tx) => {
      const r = await this.repo.getForUpdate(tx, tenantId, id);
      if (!r || !isAcceptingResponses(r.status)) return;
      const needBy = r.needBy;
      if (!needBy || needBy.getTime() >= Date.now()) return;
      r.expire();
      await this.repo.update(tx, r);
      await this.flush(tx, tenantId, id, r.pullEvents());
    }, { userId: 'system' });
  }

  async getById(tenantId: string, id: string) {
    const r = await this.repo.getById(tenantId, id);   // requirements are public WITHIN the tenant (sellers browse to quote)
    if (!r) throw new RequirementNotFoundError(id);
    return this.serialize(r.toProps());
  }

  async list(tenantId: string, actor: RequirementActor, q: { box: 'open' | 'mine'; status?: string; categoryId?: string; cursor?: { c: string; id: string }; limit: number }) {
    const rows = q.box === 'mine'
      ? await this.repo.listForBuyer(tenantId, actor.userId, { status: q.status, cursor: q.cursor, limit: q.limit })
      : await this.repo.listOpen(tenantId, { categoryId: q.categoryId, cursor: q.cursor, limit: q.limit });
    const items = rows.map((r) => this.serialize(r.toProps()));
    const last = items[items.length - 1];
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${(last as any).createdAt.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }

  private assertBuyerOrModerator(r: Requirement, actor: RequirementActor): void {
    if (actor.canModerate) return;
    if (r.buyerUserId !== actor.userId) throw new RequirementForbiddenError('only the buyer may modify this requirement');
  }
  private serialize(p: ReturnType<Requirement['toProps']>) {
    return { id: p.id, buyerUserId: p.buyerUserId, productId: p.productId, categoryId: p.categoryId, title: p.title,
      quantity: p.quantity, unitCode: p.unitCode, budgetMinMinor: p.budgetMinMinor?.toString() ?? null, budgetMaxMinor: p.budgetMaxMinor?.toString() ?? null,
      currencyCode: p.currencyCode, needBy: p.needBy, deliveryPincode: p.deliveryPincode, status: p.status, isUrgent: p.isUrgent, createdAt: p.createdAt };
  }
  private async flush(tx: TxContext, tenantId: string, requirementId: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'requirement', aggregateId: requirementId, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
