// modules/market-intel/services/mandi-price.service.ts · ingest price observations + serve the Mandi Pulse.
// ingest needs market.manage; it appends one observation (idempotent per (user, endpoint)), then EVALUATES the
// tenant's active price alerts for that product+region and emits a PriceAlertTriggered event per crossing — the
// notification spine turns those into farmer alerts. One ACID tx, outbox in-tx (Law 4). Money is bigint (Law 2).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { MandiPrice } from '../domain/mandi-price.entity';
import { DomainEvent, MarketEventType, PriceSource } from '../domain/market-intel.events';
import { MandiPriceRepository } from '../repositories/mandi-price.repository';
import { PriceAlertRepository } from '../repositories/price-alert.repository';
import { MarketNamesReadModel, withNames } from '../read-models/market-names.read-model';
import { MarketForbiddenError } from '../domain/market-intel.errors';

export interface MarketActor { userId: string; canManage: boolean; }

@Injectable()
export class MandiPriceService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly prices: MandiPriceRepository,
    private readonly alerts: PriceAlertRepository,
    private readonly names: MarketNamesReadModel,
  ) {}

  async ingest(tenantId: string, actor: MarketActor, idemKey: string, dto: { mandiId?: string | null; regionId?: string | null; productId: string; gradeOptionId?: string | null; priceDate: string; minMinor?: string | null; maxMinor?: string | null; modalMinor: string; unitCode: string; arrivalsQty?: string | null; source: string }) {
    if (!actor.canManage) throw new MarketForbiddenError('requires market.manage');
    return this.idem.remember(idemKey, actor.userId, 'market.price.ingest', () =>
      timed(this.metrics, 'market.price.ingest', { tenant: tenantId }, () =>
        this.uow.run(tenantId, async (tx) => {
          const price = MandiPrice.observe({ mandiId: dto.mandiId ?? null, regionId: dto.regionId ?? null, productId: dto.productId, gradeOptionId: dto.gradeOptionId ?? null, priceDate: dto.priceDate,
            minMinor: dto.minMinor != null ? BigInt(dto.minMinor) : null, maxMinor: dto.maxMinor != null ? BigInt(dto.maxMinor) : null, modalMinor: BigInt(dto.modalMinor), unitCode: dto.unitCode, arrivalsQty: dto.arrivalsQty ?? null, source: dto.source as PriceSource, currencyCode: 'INR' });
          await this.prices.insert(tx, price);
          for (const e of price.pullEvents()) await this.outbox.write(tx, { tenantId, aggregateType: 'mandi_price', aggregateId: dto.productId, eventType: e.type, payload: { v: 1, ...e.payload } });
          // fire matching alerts (this tenant's active subscriptions for this product+region)
          let fired = 0;
          for (const alert of await this.alerts.matchActive(tx, tenantId, price.productId, price.regionId)) {
            if (!alert.isCrossedBy(price.modalMinor)) continue;
            fired++;
            const ap = alert.toProps();
            await this.outbox.write(tx, { tenantId, aggregateType: 'price_alert', aggregateId: alert.id, eventType: MarketEventType.PriceAlertTriggered,
              payload: { v: 1, alertId: alert.id, userId: alert.userId, productId: price.productId, modalMinor: price.modalMinor.toString(), thresholdMinor: ap.thresholdMinor.toString(), direction: ap.direction } });
            // Append the trigger-log row IN this tx (Law 4) so the per-user "triggered today/this week" count (P1-3)
            // can never drift from the fired events.
            await this.alerts.insertTrigger(tx, { tenantId, alertId: alert.id, userId: alert.userId, productId: price.productId, regionId: price.regionId, direction: ap.direction, modalMinor: price.modalMinor, thresholdMinor: ap.thresholdMinor });
          }
          this.metrics.inc('market.alerts.fired', { tenant: tenantId }, fired);
          return { ...price.toJSON(), alertsFired: fired };
        }, { userId: actor.userId })));
  }

  async list(tenantId: string, q: { productId: string; regionId?: string; mandiId?: string; fromDate?: string; cursor?: { c: string; id: string }; limit: number }) {
    const rows = await this.prices.listFor(tenantId, q);
    const base = rows.map((m) => m.toJSON());
    const maps = await this.names.resolve(tenantId, base as any);   // commodity/grade/region names (bounded by the page)
    const items = base.map((m) => withNames(m as any, maps));
    const last = items[items.length - 1] as any;
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${last.priceDate}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }
}
