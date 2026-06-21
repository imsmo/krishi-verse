// apps/mobile/src/features/auctions/auction-status.ts · PURE auction logic (no React/native; SDK/ui types are
// `import type` → erased) → unit-tested. Money is bigint minor-unit strings (Law 2): the current price + min next
// bid + bid validation all use BigInt, never a float. The SERVER is the authority on whether a bid is legal
// (highest, increment, EMD, timing) — this is UX gating + display only.
import type { PillTone } from '@krishi-verse/ui-native';
import type { Auction, BidHistoryItem } from '@krishi-verse/sdk-js';

/** Auction status → chip tone. */
export function auctionStatusTone(status: string): PillTone {
  switch (status) {
    case 'live': case 'extended': return 'success';
    case 'scheduled': return 'info';
    case 'ended': case 'awaiting_approval': return 'warning';
    case 'settled': return 'accent';
    case 'cancelled': case 'failed_reserve': return 'danger';
    default: return 'neutral';
  }
}

/** Bidding is only open while live or extended. */
export function isBiddable(status: string): boolean {
  return status === 'live' || status === 'extended';
}

/** The current price = the highest visible bid (history is newest-first; the latest bid is the highest in an
 * english auction), else the auction's start price. Ignores masked (null) amounts. All bigint minor strings. */
export function currentPriceMinor(auction: Pick<Auction, 'startPriceMinor'>, bids: BidHistoryItem[]): string {
  let max: bigint | null = null;
  for (const b of bids) {
    if (b.amountMinor == null) continue;
    try { const v = BigInt(b.amountMinor); if (max === null || v > max) max = v; } catch { /* skip bad */ }
  }
  if (max === null) return auction.startPriceMinor;
  try { return max >= BigInt(auction.startPriceMinor) ? max.toString() : auction.startPriceMinor; } catch { return max.toString(); }
}

/** Minimum acceptable next bid = current + increment (bigint). */
export function minNextBidMinor(currentMinor: string, minIncrementMinor: string): string {
  try { return (BigInt(currentMinor) + BigInt(minIncrementMinor)).toString(); } catch { return currentMinor; }
}

export interface BidCheck { ok: boolean; reason?: 'invalid' | 'too_low' }

/** Validate a typed bid (whole rupees) against the required minimum (paise). Pure BigInt (Law 2). The server
 * re-validates (highest/increment/EMD/timing) and is the authority. */
export function validateBidRupees(rupees: string, minNextMinor: string): BidCheck {
  const clean = (rupees ?? '').trim();
  if (!/^\d{1,13}$/.test(clean)) return { ok: false, reason: 'invalid' };
  let amt: bigint;
  try { amt = BigInt(clean) * 100n; } catch { return { ok: false, reason: 'invalid' }; }
  if (amt <= 0n) return { ok: false, reason: 'invalid' };
  try { if (amt < BigInt(minNextMinor)) return { ok: false, reason: 'too_low' }; } catch { /* allow */ }
  return { ok: true };
}

/** Am I outbid? True when the most-recent (highest) visible bid is not mine but I have bid before. Drives the
 * "you've been outbid" banner (server push P-04 is the authoritative notify; this is the in-screen reflection). */
export function isOutbid(bids: BidHistoryItem[], myUserId: string): boolean {
  const top = bids.find((b) => b.amountMinor != null);
  if (!top) return false;
  const iHaveBid = bids.some((b) => b.bidderUserId === myUserId);
  return iHaveBid && top.bidderUserId !== myUserId;
}
