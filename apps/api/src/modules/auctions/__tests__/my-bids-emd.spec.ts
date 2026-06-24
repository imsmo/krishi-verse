// API-W7 pure test for the EMD-hold computation (node-port lane). The my-bids read-model + the keyset
// SQL run against real Postgres in the integration suite; this asserts the pure float-free money math.
import { emdHeldMinor } from '../read-models/my-bids.read-model';

describe('emdHeldMinor', () => {
  it('uses the auction fixed emd_minor when no bps is configured', () => {
    expect(emdHeldMinor(500000n, 5000n, null)).toBe(5000n);
    expect(emdHeldMinor(500000n, 5000n, 0)).toBe(5000n);   // 0 bps falls back to fixed
  });
  it('computes a percentage of the bid (basis points) with integer truncation — no float', () => {
    // 2% of ₹5,000.00 = 500000 * 200 / 10000 = 10000
    expect(emdHeldMinor(500000n, 5000n, 200)).toBe(10000n);
    // 1.5% of ₹1,234.56 = 123456 * 150 / 10000 = 1851 (truncated, never 1851.84)
    expect(emdHeldMinor(123456n, 0n, 150)).toBe(1851n);
  });
});
