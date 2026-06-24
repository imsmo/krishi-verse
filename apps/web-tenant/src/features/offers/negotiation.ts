// apps/web-tenant/src/features/offers/negotiation.ts · PURE helpers for the seller offer-negotiation pages. They
// mirror the API's listing_offers state machine (offers/domain/listing-offer.state.ts) so the console only offers
// accept/counter/reject while a negotiation is live — the API re-checks every transition (we reflect, never
// grant). No framework, no I/O → unit-tested.

export const OFFER_STATUSES = ['open', 'countered', 'accepted', 'rejected', 'expired', 'converted'] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

/** A negotiation is live (accept/counter/reject allowed) only while open or countered. */
export function isNegotiable(status: string | undefined | null): boolean {
  return status === 'open' || status === 'countered';
}
/** Terminal: nothing more to do (rejected/expired/converted). */
export function isTerminal(status: string | undefined | null): boolean {
  return status === 'rejected' || status === 'expired' || status === 'converted';
}
/** The price currently on the table is the latest counter if present, else the original offered price. */
export function effectivePriceMinor(offer: { offeredPriceMinor: string; counterPriceMinor: string | null }): string {
  return offer.counterPriceMinor ?? offer.offeredPriceMinor;
}
