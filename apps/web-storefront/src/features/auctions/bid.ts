// apps/web-storefront/src/features/auctions/bid.ts · PURE bid math. Money is bigint minor-unit STRINGS end-to-end
// (Law 2) — all arithmetic is BigInt, never a float. The server is the authority on the real minimum + EMD; these
// helpers only compute a sensible *suggested* next bid + read the current high from the (newest-first) bid history
// for display. No I/O, no framework → unit-testable.
import type { Auction, BidHistoryItem } from '@krishi-verse/sdk-js';

/** Highest visible bid amount (minor string) from a newest-first history, or null when there are none/sealed. */
export function currentHighMinor(bids: BidHistoryItem[]): string | null {
  let best: bigint | null = null;
  for (const b of bids) {
    if (!b.amountMinor) continue; // sealed-masked → not visible
    const v = BigInt(b.amountMinor);
    if (best === null || v > best) best = v;
  }
  return best === null ? null : best.toString();
}

/** The suggested minimum next bid: first bid must clear the start price; later bids must clear high + increment. */
export function minNextBidMinor(auction: Pick<Auction, 'startPriceMinor' | 'minIncrementMinor'>, bids: BidHistoryItem[]): string {
  const high = currentHighMinor(bids);
  if (high === null) return auction.startPriceMinor;
  return (BigInt(high) + BigInt(auction.minIncrementMinor || '0')).toString();
}
