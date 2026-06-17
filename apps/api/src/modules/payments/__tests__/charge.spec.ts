// modules/payments/__tests__/charge.spec.ts · the buyer-charge calculator (pure money math).
import { computeCharge, UnsupportedChargeMethodError } from '../domain/charge.calculator';

describe('computeCharge', () => {
  it('flat — fixed fee regardless of base', () => {
    expect(computeCharge('flat', { fee_minor: 3900 }, { amountMinor: 1_000_000n })).toBe(3900n);
  });

  it('percent — bps of the base, clamped by min/max', () => {
    expect(computeCharge('percent', { bps: 250 }, { amountMinor: 1_000_000n })).toBe(25_000n);   // 2.5%
    expect(computeCharge('percent', { bps: 250, min_minor: 5000 }, { amountMinor: 100_000n })).toBe(5000n); // floor up to min
    expect(computeCharge('percent', { bps: 250, max_minor: 1000 }, { amountMinor: 1_000_000n })).toBe(1000n); // cap to max
  });

  it('slab — first matching slab wins; null upto = catch-all', () => {
    const cfg = { slabs: [{ upto_minor: 39900, fee_minor: 3900 }, { upto_minor: null, fee_minor: 0 }] };
    expect(computeCharge('slab', cfg, { amountMinor: 20_000n })).toBe(3900n);   // ≤ ₹399 → ₹39 delivery
    expect(computeCharge('slab', cfg, { amountMinor: 39_900n })).toBe(3900n);   // boundary inclusive
    expect(computeCharge('slab', cfg, { amountMinor: 40_000n })).toBe(0n);      // above → free
  });

  it('per_unit — fee per quantity', () => {
    expect(computeCharge('per_unit', { fee_minor: 500 }, { amountMinor: 0n, qty: 3 })).toBe(1500n);
    expect(computeCharge('per_unit', { fee_minor: 500 }, { amountMinor: 0n })).toBe(0n);   // no qty → 0
  });

  it('fails closed on an unsupported method (per_km needs distance — deferred)', () => {
    expect(() => computeCharge('per_km' as any, {}, { amountMinor: 100n })).toThrow(UnsupportedChargeMethodError);
  });
});
