// apps/wallet-service/src/test/striping.spec.ts · platform hot-account striping must be deterministic (same
// idempotency key + account → same stripe, so a replay lands on the same row → idempotency holds), in range,
// and reasonably spread (so locks distribute across stripes).
import { platformStripe } from '../accounts/hot-account-striping';

describe('platformStripe', () => {
  it('is deterministic per (key, account)', () => {
    expect(platformStripe('idem-abc', 'escrow', 8)).toBe(platformStripe('idem-abc', 'escrow', 8));
  });
  it('stays within [0, stripeCount) and collapses to 0 when count<=1', () => {
    for (let i = 0; i < 200; i++) { const s = platformStripe(`k${i}`, 'fees', 8); expect(s).toBeGreaterThanOrEqual(0); expect(s).toBeLessThan(8); }
    expect(platformStripe('k', 'fees', 1)).toBe(0);
  });
  it('spreads keys across stripes (not all one bucket)', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(platformStripe(`key-${i}`, 'escrow', 8));
    expect(seen.size).toBeGreaterThan(4);   // hits most of the 8 stripes
  });
});
