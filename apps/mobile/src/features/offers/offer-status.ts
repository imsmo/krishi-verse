// apps/mobile/src/features/offers/offer-status.ts · PURE offer-negotiation logic (no React/native; SDK/ui types
// are `import type` → erased) → unit-tested. Mirrors the server offer state machine for NAVIGATION/UX only —
// which actions a screen may OFFER given (status, box). The SERVER re-authorizes the party (buyer vs seller) and
// the legal transition; an illegal tap is rejected. Money is bigint minor-unit strings (Law 2).
import type { PillTone } from '@krishi-verse/ui-native';
import type { OfferBox } from '@krishi-verse/sdk-js';

export type OfferAction = 'accept' | 'counter' | 'reject';

/** Offer status → chip tone. */
export function offerStatusTone(status: string): PillTone {
  switch (status) {
    case 'accepted': case 'converted': return 'success';
    case 'countered': return 'info';
    case 'open': return 'warning';
    case 'rejected': case 'expired': return 'danger';
    default: return 'neutral';
  }
}

/** Which actions a screen may OFFER for (status, box). A live negotiation (open/countered) lets the other party
 * accept/counter/reject; terminal states offer nothing. The server enforces who may actually act. */
export function offerActions(status: string, box: OfferBox): OfferAction[] {
  // Negotiation is live while open or countered. For UX both parties see the same controls; the server rejects an
  // out-of-turn action (e.g. you can't accept your own just-made offer).
  if (status === 'open' || status === 'countered') return ['accept', 'counter', 'reject'];
  return [];
}

/** Whether a negotiation is still active (drives "show actions"). */
export function isNegotiable(status: string): boolean {
  return status === 'open' || status === 'countered';
}

/** The price currently on the table (counter if present, else the original offer) — both bigint minor strings. */
export function currentOfferPriceMinor(offer: { offeredPriceMinor: string; counterPriceMinor: string | null }): string {
  return offer.counterPriceMinor ?? offer.offeredPriceMinor;
}

/** Validate a per-unit price the user typed (whole rupees) → paise minor string, or null. Positive integer only;
 * the server re-validates (it requires a positive integer minor-unit string). */
export function rupeesToOfferMinor(rupees: string): string | null {
  const clean = (rupees ?? '').trim();
  if (!/^\d{1,13}$/.test(clean)) return null;
  try { const r = BigInt(clean); return r > 0n ? (r * 100n).toString() : null; } catch { return null; }
}

/** Validate a quantity the user typed → a decimal string (up to 3 dp), or null (server contract: /^\d{1,11}(\.\d{1,3})?$/). */
export function normalizeQuantity(qty: string): string | null {
  const clean = (qty ?? '').trim();
  return /^\d{1,11}(\.\d{1,3})?$/.test(clean) && Number(clean) > 0 ? clean : null;
}
