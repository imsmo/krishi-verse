// modules/market-intel/services/price-prediction.service.ts · generate + serve fair-price bands.
// generate needs market.manage: pull recent modal observations for product+region (bounded window) → compute a
// deterministic baseline P10/P50/P90 band (float-free percentiles) → append + emit. read returns the latest band.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { PricePrediction } from '../domain/price-prediction.entity';
import { DomainEvent } from '../domain/market-intel.events';
import { PricePredictionRepository } from '../repositories/price-prediction.repository';
import { MandiPriceRepository } from '../repositories/mandi-price.repository';
import { MarketForbiddenError } from '../domain/market-intel.errors';
import { MarketActor } from './mandi-price.service';

@Injectable()
export class PricePredictionService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly predictions: PricePredictionRepository,
    private readonly prices: MandiPriceRepository,
  ) {}

  async generate(tenantId: string, actor: MarketActor, dto: { productId: string; regionId: string; gradeOptionId?: string | null; targetDate: string; lookbackDays: number }) {
    if (!actor.canManage) throw new MarketForbiddenError('requires market.manage');
    return timed(this.metrics, 'market.prediction.generate', { tenant: tenantId }, async () => {
      const from = new Date(Date.now() - dto.lookbackDays * 86400_000).toISOString().slice(0, 10);
      const modals = await this.prices.recentModals(tenantId, dto.productId, dto.regionId, from);   // read on replica
      const pred = PricePrediction.baseline({ productId: dto.productId, regionId: dto.regionId, gradeOptionId: dto.gradeOptionId ?? null, targetDate: dto.targetDate, modalsMinor: modals });
      return this.uow.run(tenantId, async (tx) => {
        await this.predictions.insert(tx, pred);
        pred.emitGenerated();
        await this.flush(tx, tenantId, dto.productId, pred.pullEvents());
        return pred.toJSON();
      }, { userId: actor.userId });
    });
  }
  async latest(tenantId: string, productId: string, regionId: string) {
    const p = await this.predictions.latest(tenantId, productId, regionId);
    return p ? p.toJSON() : null;
  }
  private async flush(tx: TxContext, tenantId: string, productId: string, evts: DomainEvent[]): Promise<void> {
    for (const e of evts) await this.outbox.write(tx, { tenantId, aggregateType: 'price_prediction', aggregateId: productId, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
