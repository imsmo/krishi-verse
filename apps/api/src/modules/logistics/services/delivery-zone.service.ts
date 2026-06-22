// modules/logistics/services/delivery-zone.service.ts · manage a tenant's serviceability/charge zones. Every
// write: one ACID tx (UoW) + outbox event in the SAME tx (Law 4) + audit row + idempotency on create. Authorization
// THROWS (logistics.manage). Reads on the replica, keyset, bounded. No money here.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { uuidv7 } from '../../../core/database/uuid.util';
import { DeliveryZone } from '../domain/delivery-zone.entity';
import { DomainEvent } from '../domain/logistics.events';
import { DeliveryZoneNotFoundError, ShipmentForbiddenError } from '../domain/logistics.errors';
import { DeliveryZoneRepository } from '../repositories/delivery-zone.repository';
import { CreateDeliveryZoneDto, UpdateDeliveryZoneDto } from '../dto/create-delivery-zone.dto';
import { QueryDeliveryZoneDto } from '../dto/query-delivery-zone.dto';
import { FleetActor, encodeFleetCursor } from './logistics-partner.service';

@Injectable()
export class DeliveryZoneService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly audit: AuditWriter,
    private readonly repo: DeliveryZoneRepository,
  ) {}

  private assertManager(a: FleetActor) { if (!a.canManage) throw new ShipmentForbiddenError('requires logistics.manage'); }

  async create(tenantId: string, actor: FleetActor, idemKey: string, dto: CreateDeliveryZoneDto, ip: string | null) {
    this.assertManager(actor);
    return this.idem.remember(idemKey, actor.userId, 'logistics.zone_create', () =>
      timed(this.metrics, 'logistics.zone_create', { tenant: tenantId }, async () => {
        const zone = DeliveryZone.create({
          id: uuidv7(), tenantId, defaultName: dto.defaultName, pincodes: dto.pincodes, regionIds: dto.regionIds,
          chargeDefinitionId: dto.chargeDefinitionId ?? null,
        });
        return this.uow.run(tenantId, async (tx) => {
          await this.repo.insert(tx, zone);
          const p = zone.toProps();
          await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'logistics.delivery_zone_created', entityType: 'delivery_zone', entityId: p.id, newValue: { defaultName: p.defaultName, pincodes: p.pincodes.length }, ip });
          await this.flush(tx, tenantId, p.id, zone.pullEvents());
          return this.serialize(p);
        }, { userId: actor.userId });
      }));
  }

  async update(tenantId: string, actor: FleetActor, id: string, dto: UpdateDeliveryZoneDto, ip: string | null) {
    this.assertManager(actor);
    return timed(this.metrics, 'logistics.zone_update', { tenant: tenantId }, () =>
      this.uow.run(tenantId, async (tx) => {
        const zone = await this.repo.getForUpdate(tx, tenantId, id);
        if (!zone) throw new DeliveryZoneNotFoundError(id);
        const diff = zone.update({ defaultName: dto.defaultName, pincodes: dto.pincodes, regionIds: dto.regionIds, chargeDefinitionId: dto.chargeDefinitionId });
        await this.repo.update(tx, zone);
        await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'logistics.delivery_zone_updated', entityType: 'delivery_zone', entityId: id, oldValue: diff.old, newValue: diff.new, ip });
        return this.serialize(zone.toProps());
      }, { userId: actor.userId }));
  }

  async setActive(tenantId: string, actor: FleetActor, id: string, isActive: boolean, ip: string | null) {
    this.assertManager(actor);
    return timed(this.metrics, 'logistics.zone_set_active', { tenant: tenantId }, () =>
      this.uow.run(tenantId, async (tx) => {
        const zone = await this.repo.getForUpdate(tx, tenantId, id);
        if (!zone) throw new DeliveryZoneNotFoundError(id);
        const diff = zone.setActive(isActive);
        await this.repo.update(tx, zone);
        await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: `logistics.delivery_zone_${diff.action}`, entityType: 'delivery_zone', entityId: id, oldValue: diff.old, newValue: diff.new, ip });
        return this.serialize(zone.toProps());
      }, { userId: actor.userId }));
  }

  async getById(tenantId: string, id: string) {
    const zone = await this.repo.getById(tenantId, id);
    if (!zone) throw new DeliveryZoneNotFoundError(id);
    return this.serialize(zone.toProps());
  }

  async list(tenantId: string, q: Omit<QueryDeliveryZoneDto, 'cursor'> & { cursor?: { c: string; id: string } }) {
    const rows = await this.repo.list(tenantId, { pincode: q.pincode, activeOnly: q.activeOnly, cursor: q.cursor, limit: q.limit });
    const items = rows.map((z) => this.serialize(z.toProps()));
    const last = items[items.length - 1];
    const nextCursor = items.length === q.limit && last ? encodeFleetCursor(last.createdAt, last.id) : null;
    return { items, nextCursor };
  }

  private serialize(p: ReturnType<DeliveryZone['toProps']>) {
    return { id: p.id, defaultName: p.defaultName, pincodes: p.pincodes, regionIds: p.regionIds, chargeDefinitionId: p.chargeDefinitionId, isActive: p.isActive, createdAt: p.createdAt ?? null };
  }
  private async flush(tx: TxContext, tenantId: string, aggregateId: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'delivery_zone', aggregateId, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
