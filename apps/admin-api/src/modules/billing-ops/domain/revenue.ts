// apps/admin-api/src/modules/billing-ops/domain/revenue.ts · pure, FLOAT-FREE revenue math (Law 2). MRR/ARR are
// derived from active subscriptions normalised to a monthly amount in bigint minor units; annual plans divide by
// 12 with integer (floor) division — never a JS float. Kept pure so the arithmetic is unit-tested in isolation.
export type BillingCycle = 'monthly' | 'annual';

/** Normalise one subscription's price to a monthly amount in minor units (annual ⇒ floor(price/12)). */
export function monthlyMinor(cycle: BillingCycle, priceMinor: bigint): bigint {
  return cycle === 'annual' ? priceMinor / 12n : priceMinor;   // bigint division floors — no float
}

/** ARR = MRR × 12 (both bigint minor units). */
export function arrMinor(mrrMinor: bigint): bigint { return mrrMinor * 12n; }

/** Sum a set of (cycle, price) pairs into total MRR (minor units). */
export function sumMrr(subs: { cycle: BillingCycle; priceMinor: bigint }[]): bigint {
  return subs.reduce((acc, s) => acc + monthlyMinor(s.cycle, s.priceMinor), 0n);
}
