// modules/exports/services/export-shipment.service.ts · export shipment lifecycle (exporter-driven).
// draft → docs_in_progress → inspection → shipped → delivered → paid → closed. THE DOCS GATE: a shipment
// cannot advance to 'shipped' unless it has ≥1 document and EVERY document is verified (compliance proof).
// No in-platform money (total_value_minor is informational; 'paid' records LC/bank confirmation). One ACID
// tx (UoW), state via the machine (Law 5), outbox in-tx (Law 4), idempotency on create, authz THROWS (Law 6).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { QUOTA_SERVICE, QuotaService } from '../../../core/quota/quota.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { uuidv7 } from '../../../core/database/uuid.util';
import { ExportShipment } from '../domain/export-shipment.entity';
import { ShipmentStatus } from '../domain/export-shipment.state';
import { DomainEvent } from '../domain/exports.events';
import { ExportShipmentRepository } from '../repositories/export-shipment.repository';
import { ExportDocumentRepository } from '../repositories/export-document.repository';
import { CreateShipmentDto, AdvanceShipmentDto } from '../dto/create-export-shipment.dto';
import { ShipmentNotFoundError, DocsNotClearedError, ExportsForbiddenError } from '../domain/exports.errors';
import { ExportsActor } from './exporter-registration.service';

const QUOTA_METRIC = 'export_shipments';

@Injectable()
export class ExportShipmentService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(QUOTA_SERVICE) private readonly quota: QuotaService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly audit: AuditWriter,
    private readonly repo: ExportShipmentRepository,
    private readonly docs: ExportDocumentRepository,
  ) {}

  async create(tenantId: string, actor: ExportsActor, idemKey: string, dto: CreateShipmentDto) {
    if (!actor.canManage) throw new ExportsForbiddenError('requires export.manage');
    return this.idem.remember(idemKey, actor.userId, 'exports.shipment.create', () =>
      timed(this.metrics, 'exports.shipment.create', { tenant: tenantId }, async () => {
        await this.quota.assertWithinLimit(tenantId, QUOTA_METRIC);
        return this.uow.run(tenantId, async (tx) => {
          const s = ExportShipment.create({ id: uuidv7(), tenantId, exporterUserId: actor.userId, destinationCountry: dto.destinationCountry, incoterm: dto.incoterm ?? null,
            orderIds: dto.orderIds, vesselOrAwb: null, lcRef: null, totalValueMinor: dto.totalValueMinor != null ? BigInt(dto.totalValueMinor) : null, currencyCode: dto.currencyCode });
          await this.repo.insert(tx, s);
          await this.quota.increment(tx, tenantId, QUOTA_METRIC, 1);
          await this.flush(tx, tenantId, s.id, s.pullEvents());
          return s.toJSON();
        }, { userId: actor.userId });
      }));
  }

  async advance(tenantId: string, actor: ExportsActor, id: string, dto: AdvanceShipmentDto, ip: string | null) {
    if (!actor.canManage) throw new ExportsForbiddenError('requires export.manage');
    return this.uow.run(tenantId, async (tx) => {
      const s = await this.repo.getForUpdate(tx, tenantId, id);
      if (!s) throw new ShipmentNotFoundError(id);
      if (s.exporterUserId !== actor.userId && !actor.isAdmin) throw new ExportsForbiddenError('only the exporter may drive this shipment');
      if (dto.to === 'shipped') {
        const { total, notVerified } = await this.docs.countNotVerified(tx, tenantId, id);
        if (total === 0 || notVerified > 0) throw new DocsNotClearedError();   // compliance gate
      }
      s.setShippingRefs({ vesselOrAwb: dto.vesselOrAwb, lcRef: dto.lcRef });
      s.advance(dto.to as ShipmentStatus);
      await this.repo.update(tx, s);
      await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'exports.shipment.progressed', entityType: 'export_shipment', entityId: s.id, newValue: { to: dto.to }, ip });
      await this.flush(tx, tenantId, s.id, s.pullEvents());
      return s.toJSON();
    }, { userId: actor.userId });
  }

  async getById(tenantId: string, actor: ExportsActor, id: string) {
    const s = await this.repo.getById(tenantId, id);
    if (!s) throw new ShipmentNotFoundError(id);
    if (s.exporterUserId !== actor.userId && !actor.isAdmin) throw new ShipmentNotFoundError(id); // 404, no IDOR
    return s.toJSON();
  }
  async list(tenantId: string, actor: ExportsActor, q: { box: 'mine' | 'all'; status?: string; cursor?: { c: string; id: string }; limit: number }) {
    if (q.box === 'all' && !actor.isAdmin) throw new ExportsForbiddenError('requires booking.manage');
    const rows = await this.repo.listFor(tenantId, { exporterUserId: q.box === 'mine' ? actor.userId : undefined, status: q.status, cursor: q.cursor, limit: q.limit });
    const items = rows.map((s) => s.toJSON());
    const last = items[items.length - 1];
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${(last as any).createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }
  private async flush(tx: TxContext, tenantId: string, id: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'export_shipment', aggregateId: id, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
