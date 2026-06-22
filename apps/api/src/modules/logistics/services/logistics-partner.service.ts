// modules/logistics/services/logistics-partner.service.ts · register/manage a tenant's carriers (3PL link,
// own fleet, rider). Every write: one ACID tx (UoW), outbox event in the SAME tx (Law 4), audit row for the
// state-changing action, idempotency on create. Authorization THROWS (logistics.manage). Reads on the replica,
// keyset-paginated, always bounded. Platform 3PLs (tenant_id NULL) are read-only here — written by admin-api (Law 11).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { uuidv7 } from '../../../core/database/uuid.util';
import { LogisticsPartner } from '../domain/logistics-partner.entity';
import { DomainEvent } from '../domain/logistics.events';
import { PartnerNotFoundError, ShipmentForbiddenError } from '../domain/logistics.errors';
import { LogisticsPartnerRepository } from '../repositories/logistics-partner.repository';
import { CreateLogisticsPartnerDto, UpdateLogisticsPartnerDto } from '../dto/create-logistics-partner.dto';
import { QueryLogisticsPartnerDto } from '../dto/query-logistics-partner.dto';

export interface FleetActor { userId: string; canManage: boolean; }

/** Shared keyset cursor codec for the fleet read models (created_at|id, base64). */
export function encodeFleetCursor(createdAt: Date | string | null, id: string): string {
  const iso = createdAt instanceof Date ? createdAt.toISOString() : String(createdAt);
  return Buffer.from(`${iso}|${id}`).toString('base64');
}

@Injectable()
export class LogisticsPartnerService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly audit: AuditWriter,
    private readonly repo: LogisticsPartnerRepository,
  ) {}

  private assertManager(a: FleetActor) { if (!a.canManage) throw new ShipmentForbiddenError('requires logistics.manage'); }

  async create(tenantId: string, actor: FleetActor, idemKey: string, dto: CreateLogisticsPartnerDto, ip: string | null) {
    this.assertManager(actor);
    return this.idem.remember(idemKey, actor.userId, 'logistics.partner_create', () =>
      timed(this.metrics, 'logistics.partner_create', { tenant: tenantId }, async () => {
        const partner = LogisticsPartner.create({
          id: uuidv7(), tenantId, partnerKind: dto.partnerKind, providerCode: dto.providerCode ?? null,
          defaultName: dto.defaultName, riderUserId: dto.riderUserId ?? null, supportsColdChain: dto.supportsColdChain,
        });
        return this.uow.run(tenantId, async (tx) => {
          await this.repo.insert(tx, partner);
          const p = partner.toProps();
          await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'logistics.partner_registered', entityType: 'logistics_partner', entityId: p.id, newValue: { partnerKind: p.partnerKind, defaultName: p.defaultName }, ip });
          await this.flush(tx, tenantId, p.id, partner.pullEvents());
          return this.serialize(p);
        }, { userId: actor.userId });
      }));
  }

  async update(tenantId: string, actor: FleetActor, id: string, dto: UpdateLogisticsPartnerDto, ip: string | null) {
    this.assertManager(actor);
    return timed(this.metrics, 'logistics.partner_update', { tenant: tenantId }, () =>
      this.uow.run(tenantId, async (tx) => {
        const partner = await this.repo.getForUpdate(tx, tenantId, id);
        if (!partner) throw new PartnerNotFoundError(id);
        const diff = partner.update({ defaultName: dto.defaultName, providerCode: dto.providerCode, supportsColdChain: dto.supportsColdChain });
        await this.repo.update(tx, partner);
        await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'logistics.partner_updated', entityType: 'logistics_partner', entityId: id, oldValue: diff.old, newValue: diff.new, ip });
        return this.serialize(partner.toProps());
      }, { userId: actor.userId }));
  }

  async setActive(tenantId: string, actor: FleetActor, id: string, isActive: boolean, ip: string | null) {
    this.assertManager(actor);
    return timed(this.metrics, 'logistics.partner_set_active', { tenant: tenantId }, () =>
      this.uow.run(tenantId, async (tx) => {
        const partner = await this.repo.getForUpdate(tx, tenantId, id);
        if (!partner) throw new PartnerNotFoundError(id);
        const diff = partner.setActive(isActive);
        await this.repo.update(tx, partner);
        await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: `logistics.partner_${diff.action}`, entityType: 'logistics_partner', entityId: id, oldValue: diff.old, newValue: diff.new, ip });
        return this.serialize(partner.toProps());
      }, { userId: actor.userId }));
  }

  async getById(tenantId: string, id: string) {
    const partner = await this.repo.getById(tenantId, id);
    if (!partner) throw new PartnerNotFoundError(id);
    return this.serialize(partner.toProps());
  }

  async list(tenantId: string, q: Omit<QueryLogisticsPartnerDto, 'cursor'> & { cursor?: { c: string; id: string } }) {
    const rows = await this.repo.list(tenantId, { partnerKind: q.partnerKind, activeOnly: q.activeOnly, includePlatform: q.includePlatform, cursor: q.cursor, limit: q.limit });
    const items = rows.map((e) => this.serialize(e.toProps()));
    const last = items[items.length - 1];
    const nextCursor = items.length === q.limit && last ? encodeFleetCursor(last.createdAt, last.id) : null;
    return { items, nextCursor };
  }

  private serialize(p: ReturnType<LogisticsPartner['toProps']>) {
    return { id: p.id, scope: p.tenantId == null ? 'platform' : 'tenant', partnerKind: p.partnerKind, providerCode: p.providerCode,
      defaultName: p.defaultName, riderUserId: p.riderUserId, supportsColdChain: p.supportsColdChain, isActive: p.isActive, createdAt: p.createdAt ?? null };
  }
  private async flush(tx: TxContext, tenantId: string, aggregateId: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'logistics_partner', aggregateId, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
