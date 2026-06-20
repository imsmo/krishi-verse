// modules/market-intel/__tests__/market-intel-domain.spec.ts · pure-domain invariants (no I/O).
// Pins: price observation bounds (min≤modal≤max, positive); baseline band percentiles (float-free, p10≤p50≤p90,
// needs ≥3); alert crossing (above/below); alert threshold positivity.
import { MandiPrice } from '../domain/mandi-price.entity';
import { PricePrediction } from '../domain/price-prediction.entity';
import { PriceAlert } from '../domain/price-alert.entity';
import { InvalidPriceError, InvalidAlertError, NoPriceDataError } from '../domain/market-intel.errors';

const obs = (over: Partial<any> = {}) => MandiPrice.observe({ mandiId: null, regionId: 'r1', productId: 'p1', gradeOptionId: null, priceDate: '2026-06-20', minMinor: 200000n, maxMinor: 300000n, modalMinor: 250000n, unitCode: 'quintal', arrivalsQty: null, source: 'agmarknet', currencyCode: 'INR', ...over });

describe('MandiPrice.observe', () => {
  it('accepts a valid observation + emits PriceIngested', () => {
    expect(obs().pullEvents().map((e) => e.type)).toContain('market.price_ingested');
  });
  it('rejects non-positive modal, min>modal, max<modal', () => {
    expect(() => obs({ modalMinor: 0n })).toThrow(InvalidPriceError);
    expect(() => obs({ minMinor: 300000n })).toThrow(InvalidPriceError);
    expect(() => obs({ maxMinor: 100000n })).toThrow(InvalidPriceError);
  });
});

describe('PricePrediction.baseline', () => {
  it('computes nearest-rank percentile band; p10≤p50≤p90; model baseline-v1', () => {
    const modals = [100n, 200n, 300n, 400n, 500n, 600n, 700n, 800n, 900n, 1000n];
    const p = PricePrediction.baseline({ productId: 'p1', regionId: 'r1', gradeOptionId: null, targetDate: '2026-06-25', modalsMinor: modals }).toJSON();
    expect(BigInt(p.p10Minor) <= BigInt(p.p50Minor)).toBe(true);
    expect(BigInt(p.p50Minor) <= BigInt(p.p90Minor)).toBe(true);
    expect(p.modelVersion).toBe('baseline-v1'); expect(p.p10Minor).toBe('100'); expect(p.p90Minor).toBe('900');
  });
  it('needs at least 3 observations', () => {
    expect(() => PricePrediction.baseline({ productId: 'p1', regionId: 'r1', gradeOptionId: null, targetDate: 'd', modalsMinor: [1n, 2n] })).toThrow(NoPriceDataError);
  });
});

describe('PriceAlert', () => {
  const mk = (dir: any, thr: bigint) => PriceAlert.create({ id: 'a1', tenantId: 't1', userId: 'u1', productId: 'p1', regionId: 'r1', direction: dir, thresholdMinor: thr });
  it('above fires when modal ≥ threshold; below fires when modal ≤ threshold', () => {
    expect(mk('above', 250000n).isCrossedBy(260000n)).toBe(true);
    expect(mk('above', 250000n).isCrossedBy(240000n)).toBe(false);
    expect(mk('below', 250000n).isCrossedBy(240000n)).toBe(true);
    expect(mk('below', 250000n).isCrossedBy(260000n)).toBe(false);
  });
  it('rejects a non-positive threshold', () => { expect(() => mk('above', 0n)).toThrow(InvalidAlertError); });
});
