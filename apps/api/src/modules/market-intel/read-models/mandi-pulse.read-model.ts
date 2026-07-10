// modules/market-intel/read-models/mandi-pulse.read-model.ts · the farmer-home "Mandi Pulse" composite read.
// Combines the latest observed price + the latest fair-price band + a short recent history for a product+region,
// all from the replica (CQRS, Law 12). No writes; bounded history.
import { Injectable } from '@nestjs/common';
import { MandiPriceRepository } from '../repositories/mandi-price.repository';
import { PricePredictionRepository } from '../repositories/price-prediction.repository';
import { MarketNamesReadModel, withNames } from './market-names.read-model';

/** PURE (float-free): day-over-day change from the recent history (sorted price_date DESC). Compares the latest
 *  modal to the modal of the most recent STRICTLY-EARLIER price_date. Δ in basis points = (latest−prev)/prev·10000
 *  via bigint (truncated). Returns null when there is no earlier day or the previous modal is 0 (no fabrication). */
export function dayOverDayChange(history: { priceDate: string; modalMinor: string }[]): { previousModalMinor: string; previousDate: string; changeMinor: string; changeBps: number } | null {
  if (history.length < 2) return null;
  const latest = history[0];
  const prevRow = history.find((h) => h.priceDate < latest.priceDate);
  if (!prevRow) return null;
  const cur = BigInt(latest.modalMinor);
  const prev = BigInt(prevRow.modalMinor);
  if (prev === 0n) return null;
  const diff = cur - prev;
  const changeBps = Number((diff * 10000n) / prev);
  return { previousModalMinor: prev.toString(), previousDate: prevRow.priceDate, changeMinor: diff.toString(), changeBps };
}

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
    // Day-over-day Δ% from the loaded history (pure; null when there's no earlier day → rendered honestly).
    const change = dayOverDayChange(historyJson.map((h: any) => ({ priceDate: h.priceDate, modalMinor: h.modalMinor })));
    return {
      latest: latestJson ? withNames(latestJson as any, maps) : null,
      band: bandJson ? withNames(bandJson as any, maps) : null,
      history: historyJson.map((h) => withNames(h as any, maps)),
      change,
    };
  }
}
