// modules/market-intel/domain/price-prediction.entity.ts · an AI fair-price band (price_predictions, GLOBAL,
// PARTITIONED by created_at). P10/P50/P90 in bigint minor units. The baseline model derives the band from recent
// modal prices via the nearest-rank percentile (float-free); an external model can supersede with its own band.
import { DomainEvent, MarketEventType } from './market-intel.events';
import { InvalidPriceError, NoPriceDataError } from './market-intel.errors';

export interface PricePredictionProps {
  id?: string; productId: string; regionId: string; gradeOptionId: string | null; targetDate: string;
  p10Minor: bigint; p50Minor: bigint; p90Minor: bigint; confidence: number | null; modelVersion: string; createdAt?: Date;
}
/** Nearest-rank percentile on a bigint sample (1..100). Float-free; deterministic. */
function percentile(sortedAsc: bigint[], p: number): bigint {
  const n = sortedAsc.length;
  const rank = Math.ceil((p / 100) * n);                 // 1-based
  const idx = Math.min(Math.max(rank, 1), n) - 1;
  return sortedAsc[idx];
}
export class PricePrediction {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: PricePredictionProps) {}

  /** Baseline band from recent modal observations (need ≥3). confidence scales with sample size (cap 0.9). */
  static baseline(input: { productId: string; regionId: string; gradeOptionId: string | null; targetDate: string; modalsMinor: bigint[] }): PricePrediction {
    if (input.modalsMinor.length < 3) throw new NoPriceDataError();
    const sorted = [...input.modalsMinor].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const p10 = percentile(sorted, 10), p50 = percentile(sorted, 50), p90 = percentile(sorted, 90);
    const confidence = Math.min(0.9, 0.4 + 0.05 * sorted.length);
    return new PricePrediction({ ...input, p10Minor: p10, p50Minor: p50, p90Minor: p90, confidence: Math.round(confidence * 10000) / 10000, modelVersion: 'baseline-v1' });
  }
  static record(input: Omit<PricePredictionProps, 'createdAt' | 'id'>): PricePrediction {
    if (!(input.p10Minor <= input.p50Minor && input.p50Minor <= input.p90Minor)) throw new InvalidPriceError('band must satisfy p10 ≤ p50 ≤ p90');
    return new PricePrediction(input);
  }
  static rehydrate(p: PricePredictionProps): PricePrediction { return new PricePrediction(p); }
  get productId() { return this.props.productId; }
  toProps(): Readonly<PricePredictionProps> { return Object.freeze({ ...this.props }); }
  emitGenerated(): void { this.events.push({ type: MarketEventType.PredictionGenerated, payload: { productId: this.props.productId, regionId: this.props.regionId, targetDate: this.props.targetDate, modelVersion: this.props.modelVersion } }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }
  toJSON() { const v = this.props; return { productId: v.productId, regionId: v.regionId, gradeOptionId: v.gradeOptionId, targetDate: v.targetDate, p10Minor: v.p10Minor.toString(), p50Minor: v.p50Minor.toString(), p90Minor: v.p90Minor.toString(), confidence: v.confidence, modelVersion: v.modelVersion, createdAt: v.createdAt }; }
}
