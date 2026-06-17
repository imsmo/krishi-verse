// modules/payments/__tests__/commission.spec.ts · the settlement calculator (pure money math).
// Seller net is the RESIDUAL, so the split ALWAYS sums back to gross (zero-sum) regardless of rounding.
import { computeSettlement, applyBps } from '../domain/commission-rule.entity';
import { SettlementConfigError } from '../domain/commission.errors';

const directRule = { rateBps: 350, fixedMinor: 0n, capMinor: null as bigint | null, platformShareBps: 1000, chargedTo: 'seller' as const };
const gst = { rateBps: 500, thresholdMinor: null };
const tds = { rateBps: 100, thresholdMinor: 500000n };

function sums(b: ReturnType<typeof computeSettlement>): bigint {
  // the legs the handler posts (excluding the −gross escrow debit) must equal gross
  return b.sellerNetMinor + b.tenantCommissionMinor + b.platformShareMinor + b.gstOnCommissionMinor + b.tdsMinor;
}

describe('computeSettlement', () => {
  it('applyBps floors correctly (bigint, never float)', () => {
    expect(applyBps(1_000_000n, 350)).toBe(35_000n);  // 3.5%
    expect(applyBps(99_999n, 100)).toBe(999n);         // floor(999.99)
  });

  it('splits a ₹10,000 direct order and the legs sum back to gross (zero-sum)', () => {
    const b = computeSettlement(1_000_000n, directRule, gst, tds);
    expect(b.commissionMinor).toBe(35_000n);
    expect(b.platformShareMinor).toBe(3_500n);
    expect(b.tenantCommissionMinor).toBe(31_500n);
    expect(b.gstOnCommissionMinor).toBe(1_750n);       // 5% of commission
    expect(b.tdsMinor).toBe(10_000n);                  // 1% of gross (≥ ₹5000 threshold)
    expect(b.sellerNetMinor).toBe(953_250n);
    expect(sums(b)).toBe(1_000_000n);                  // ZERO-SUM
  });

  it('skips TDS below the threshold', () => {
    const b = computeSettlement(150_000n, directRule, gst, tds);   // ₹1500 < ₹5000
    expect(b.tdsMinor).toBe(0n);
    expect(sums(b)).toBe(150_000n);
  });

  it('honours a commission cap (labour ₹100 pattern)', () => {
    const capped = { rateBps: 150, fixedMinor: 0n, capMinor: 10_000n, platformShareBps: 800, chargedTo: 'seller' as const };
    const b = computeSettlement(1_000_000n, capped, null, null);   // 1.5% = 15000, capped to 10000
    expect(b.commissionMinor).toBe(10_000n);
    expect(sums(b)).toBe(1_000_000n);
  });

  it('zero-sum holds with rounding-prone rates (residual absorbs the remainder)', () => {
    const odd = { rateBps: 333, fixedMinor: 7n, capMinor: null as bigint | null, platformShareBps: 777, chargedTo: 'seller' as const };
    const b = computeSettlement(123_457n, odd, { rateBps: 333, thresholdMinor: null }, { rateBps: 111, thresholdMinor: 0n });
    expect(sums(b)).toBe(123_457n);                    // always balances
  });

  it('fails closed when rates would make the seller net negative', () => {
    const greedy = { rateBps: 9000, fixedMinor: 0n, capMinor: null as bigint | null, platformShareBps: 1000, chargedTo: 'seller' as const };
    expect(() => computeSettlement(1000n, greedy, { rateBps: 5000, thresholdMinor: null }, { rateBps: 5000, thresholdMinor: 0n })).toThrow(SettlementConfigError);
  });
});
