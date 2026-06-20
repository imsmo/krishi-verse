// modules/market-intel/read-models/mandi-pulse.read-model.ts · the farmer-home "Mandi Pulse" composite read.
// Combines the latest observed price + the latest fair-price band + a short recent history for a product+region,
// all from the replica (CQRS, Law 12). No writes; bounded history.
import { Injectable } from '@nestjs/common';
import { MandiPriceRepository } from '../repositories/mandi-price.repository';
import { PricePredictionRepository } from '../repositories/price-prediction.repository';

@Injectable()
export class MandiPulseReadModel {
  constructor(private readonly prices: MandiPriceRepository, private readonly predictions: PricePredictionRepository) {}
  async pulse(tenantId: string, productId: string, regionId: string | null) {
    const latest = await this.prices.latest(tenantId, productId, regionId);
    const band = regionId ? await this.predictions.latest(tenantId, productId, regionId) : null;
    const history = await this.prices.listFor(tenantId, { productId, regionId: regionId ?? undefined, limit: 14 });
    return { latest: latest?.toJSON() ?? null, band: band?.toJSON() ?? null, history: history.map((h) => h.toJSON()) };
  }
}
