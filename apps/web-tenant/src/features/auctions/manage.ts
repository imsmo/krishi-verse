// apps/web-tenant/src/features/auctions/manage.ts · PURE helpers for the seller auctions pages. canApprove/
// canCancel mirror the API's auction state machine (auctions/domain/auction.state.ts) so the console only offers
// legal actions; buildCreateAuction validates + assembles the create payload (money float-free, Law 2; end after
// start). No framework, no I/O → unit-tested. The API re-checks every transition + ownership (we reflect, never
// grant).
import { parseMajorToMinor } from '../listings/form';

export const AUCTION_STATUSES = ['scheduled', 'live', 'extended', 'ended', 'awaiting_approval', 'settled', 'cancelled', 'failed_reserve'] as const;
export const AUCTION_KINDS = ['english_open', 'sealed'] as const;
export type AuctionKind = (typeof AUCTION_KINDS)[number];

/** The seller approves a result only while it awaits their approval. */
export function canApprove(status: string | undefined | null): boolean {
  return status === 'awaiting_approval';
}
/** Cancel is legal before the auction has ended/settled (scheduled/live/extended/awaiting_approval). */
export function canCancel(status: string | undefined | null): boolean {
  return status === 'scheduled' || status === 'live' || status === 'extended' || status === 'awaiting_approval';
}

export interface CreateAuctionInput {
  listingId: string; kind: AuctionKind; startPriceMinor: string;
  reservePriceMinor?: string; minIncrementMinor?: string; emdMinor?: string;
  startsAt: string; endsAt: string; requiresSellerApproval?: boolean;
}
export type AuctionResult =
  | { ok: true; value: CreateAuctionInput }
  | { ok: false; error: 'listing' | 'startPrice' | 'reserve' | 'increment' | 'emd' | 'window' };

/** Validate + assemble a create-auction payload. `startsAtIso`/`endsAtIso` are already ISO (the action converts
 *  the datetime-local inputs); we validate end strictly after start. Optional money fields, when present, must be
 *  well-formed minor strings. */
export function buildCreateAuction(raw: {
  listingId?: string; kind?: string; startPriceMajor?: string; reservePriceMajor?: string;
  minIncrementMajor?: string; emdMajor?: string; startsAtIso?: string; endsAtIso?: string; requiresSellerApproval?: string;
}): AuctionResult {
  const listingId = (raw.listingId ?? '').trim();
  if (!listingId) return { ok: false, error: 'listing' };
  const kind: AuctionKind = raw.kind === 'sealed' ? 'sealed' : 'english_open';

  const startPriceMinor = parseMajorToMinor(raw.startPriceMajor);
  if (startPriceMinor === undefined || startPriceMinor === '0') return { ok: false, error: 'startPrice' };

  let reservePriceMinor: string | undefined;
  if ((raw.reservePriceMajor ?? '').trim()) {
    const v = parseMajorToMinor(raw.reservePriceMajor);
    if (v === undefined) return { ok: false, error: 'reserve' };
    reservePriceMinor = v;
  }
  let minIncrementMinor: string | undefined;
  if ((raw.minIncrementMajor ?? '').trim()) {
    const v = parseMajorToMinor(raw.minIncrementMajor);
    if (v === undefined || v === '0') return { ok: false, error: 'increment' };
    minIncrementMinor = v;
  }
  let emdMinor: string | undefined;
  if ((raw.emdMajor ?? '').trim()) {
    const v = parseMajorToMinor(raw.emdMajor);
    if (v === undefined) return { ok: false, error: 'emd' };
    emdMinor = v;
  }

  const startsAt = (raw.startsAtIso ?? '').trim();
  const endsAt = (raw.endsAtIso ?? '').trim();
  const s = Date.parse(startsAt); const e = Date.parse(endsAt);
  if (!startsAt || !endsAt || Number.isNaN(s) || Number.isNaN(e) || e <= s) return { ok: false, error: 'window' };

  return {
    ok: true,
    value: { listingId, kind, startPriceMinor, reservePriceMinor, minIncrementMinor, emdMinor, startsAt, endsAt, requiresSellerApproval: raw.requiresSellerApproval === 'on' || raw.requiresSellerApproval === 'true' },
  };
}
