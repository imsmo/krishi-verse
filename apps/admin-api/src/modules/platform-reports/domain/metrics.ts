// apps/admin-api/src/modules/platform-reports/domain/metrics.ts · pure, FLOAT-FREE exec-metric math (Law 2).
// Money is bigint MINOR UNITS throughout; ratios are returned as integer BASIS POINTS (1% = 100 bps) so there is
// never a JS float in a financial/operational figure. Mirrors plans-ops/billing-ops revenue normalisation so MRR
// is consistent platform-wide.
export type BillingCycle = 'monthly' | 'annual';

/** Normalise a subscription's price to a monthly amount (annual ⇒ floor(price/12)) — bigint, no float. */
export function monthlyMinor(cycle: BillingCycle, priceMinor: bigint): bigint {
  return cycle === 'annual' ? priceMinor / 12n : priceMinor;
}
export function arrMinor(mrrMinor: bigint): bigint { return mrrMinor * 12n; }
export function sumMrr(subs: { cycle: BillingCycle; priceMinor: bigint }[]): bigint {
  return subs.reduce((acc, s) => acc + monthlyMinor(s.cycle, s.priceMinor), 0n);
}

/** Ratio as integer basis points: floor(numerator * 10000 / denominator). 0 when denominator is 0. Float-free. */
export function bps(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return Math.floor((numerator * 10000) / denominator);
}

/** Average order value in minor units: floor(gmvMinor / orders). 0 when no orders. bigint, no float. */
export function avgOrderValueMinor(gmvMinor: bigint, orders: number): bigint {
  if (orders <= 0) return 0n;
  return gmvMinor / BigInt(orders);
}
