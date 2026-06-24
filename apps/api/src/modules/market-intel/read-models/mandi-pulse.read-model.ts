// modules/market-intel/read-models/mandi-pulse.read-model.ts · the farmer-home "Mandi Pulse" composite read.
// Combines the latest observed price + the latest fair-price band + a short recent history for a product+region,
// all from the replica (CQRS, Law 12). No writes; bounded history.
import { Injectable } from '@nestjs/common';
import { MandiPriceRepository } from '../repositories/mandi-price.repository';
import { PricePredictionRepository } from '../repositories/price-prediction.repository';
import { MarketNamesReadModel, withNames } from './market-names.read-model';

@Injectable()
export class MandiPulseReadModel {
  constructor(
    private readonly prices: MandiPriceRepository,
    private readonly predictions: PricePredictionRepository,
    private readonly names: MarketNamesReadModel,
  ) {}
  async pulse(tenantId: string, productId: string, regionId: string | null) {
    const latest = await this.prices.latest(tenantId, productId, regionId);
    const band = regionId ? await this.predictions.latest(tenantId, productId, regionId) : null;
    const history = await this.prices.listFor(tenantId, { productId, regionId: regionId ?? undefined, limit: 14 });
    // Resolve commodity/grade/region names for everything referenced (bounded set), then attach (Law 12 read join).
    const latestJson = latest?.toJSON() ?? null;
    const bandJson = band?.toJSON() ?? null;
    const historyJson = history.map((h) => h.toJSON());
    const rows = [...(latestJson ? [latestJson] : []), ...(bandJson ? [bandJson] : []), ...historyJson];
    const maps = await this.names.resolve(tenantId, rows as any);
    return {
      latest: latestJson ? withNames(latestJson as any, maps) : null,
      band: bandJson ? withNames(bandJson as any, maps) : null,
      history: historyJson.map((h) => withNames(h as any, maps)),
    };
  }
}
