// modules/services-marketplace/services/service-offering.service.ts · provider offering use-cases.
// One ACID tx per write (UoW), outbox in-tx (Law 4), idempotent create (Law 3), quota on create, authz THROWS (Law 6).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { QUOTA_SERVICE, QuotaService } from '../../../core/quota/quota.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { uuidv7 } from '../../../core/database/uuid.util';
import { ServiceOffering } from '../domain/service-offering.entity';
import { PricingModel, OfferingStatus, DomainEvent } from '../domain/services-marketplace.events';
import { ServiceOfferingRepository } from '../repositories/service-offering.repository';
import { CreateOfferingDto } from '../dto/create-service-offering.dto';
import { UpdateOfferingDto } from '../dto/update-service-offering.dto';
import { OfferingNotFoundError, ServicesForbiddenError } from '../domain/services-marketplace.errors';

const QUOTA_METRIC = 'service_offerings';
export interface ServicesActor { userId: string; canOffer: boolean; canBook: boolean; isAdmin: boolean; }

@Injectable()
export class ServiceOfferingService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(QUOTA_SERVICE) private readonly quota: QuotaService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly repo: ServiceOfferingRepository,
  ) {}

  async create(tenantId: string, actor: ServicesActor, idemKey: string, dto: CreateOfferingDto) {
    if (!actor.canOffer) throw new ServicesForbiddenError('requires service.offer');
    return this.idem.remember(idemKey, actor.userId, 'services.offering.create', () =>
      timed(this.metrics, 'services.offering.create', { tenant: tenantId }, async () => {
        await this.quota.assertWithinLimit(tenantId, QUOTA_METRIC);
        return this.uow.run(tenantId, async (tx) => {
          const o = ServiceOffering.create({ id: uuidv7(), tenantId, providerUserId: actor.userId, categoryId: dto.categoryId, defaultTitle: dto.defaultTitle, description: dto.description ?? null,
            pricingModel: dto.pricingModel as PricingModel, priceMinor: BigInt(dto.priceMinor), currencyCode: 'INR', capacityPerSlot: dto.capacityPerSlot ?? null, serviceRadiusKm: dto.serviceRadiusKm ?? null, addressId: dto.addressId ?? null });
          await this.repo.insert(tx, o);
          await this.quota.increment(tx, tenantId, QUOTA_METRIC, 1);
          await this.flush(tx, tenantId, o.id, o.pullEvents());
          return o.toJSON();
        }, { userId: actor.userId });
      }));
  }
  async update(tenantId: string, actor: ServicesActor, id: string, dto: UpdateOfferingDto) {
    return this.mutate(tenantId, actor, id, (o) => o.update({ ...dto, priceMinor: dto.priceMinor !== undefined ? BigInt(dto.priceMinor) : undefined }));
  }
  async setStatus(tenantId: string, actor: ServicesActor, id: string, action: 'publish' | 'pause' | 'archive') {
    return this.mutate(tenantId, actor, id, (o) => { if (action === 'publish') o.publish(); else if (action === 'pause') o.pause(); else o.archive(); });
  }
  async getById(tenantId: string, id: string) { const o = await this.repo.getById(tenantId, id); if (!o) throw new OfferingNotFoundError(id); return o.toJSON(); }
  async list(tenantId: string, actor: ServicesActor, q: { box: 'mine' | 'browse' | 'all'; categoryId?: string; status?: string; cursor?: { c: string; id: string }; limit: number }) {
    if (q.box === 'all' && !actor.isAdmin) throw new ServicesForbiddenError('requires booking.manage');
    const rows = await this.repo.listFor(tenantId, { providerUserId: q.box === 'mine' ? actor.userId : undefined, browse: q.box === 'browse', categoryId: q.categoryId, status: q.status, cursor: q.cursor, limit: q.limit });
    const items = rows.map((o) => o.toJSON());
    const last = items[items.length - 1];
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${(last as any).createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }
  private async mutate(tenantId: string, actor: ServicesActor, id: string, fn: (o: ServiceOffering) => void) {
    if (!actor.canOffer) throw new ServicesForbiddenError('requires service.offer');
    return this.uow.run(tenantId, async (tx) => {
      const o = await this.repo.getForUpdate(tx, tenantId, id);
      if (!o) throw new OfferingNotFoundError(id);
      if (o.providerUserId !== actor.userId && !actor.isAdmin) throw new ServicesForbiddenError('only the provider may modify this offering');
      fn(o);
      await this.repo.update(tx, o);
      await this.flush(tx, tenantId, o.id, o.pullEvents());
      return o.toJSON();
    }, { userId: actor.userId });
  }
  private async flush(tx: TxContext, tenantId: string, id: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'service_offering', aggregateId: id, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
