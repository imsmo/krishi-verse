// modules/offers/domain/offers.events.ts · integration events (via outbox, Law 4).
export const OfferEventType = {
  Made:      'offers.offer_made',
  Countered: 'offers.offer_countered',
  Accepted:  'offers.offer_accepted',     // a deal is struck → orders may create the order (downstream, Law 11)
  Rejected:  'offers.offer_rejected',
  Expired:   'offers.offer_expired',
  Converted: 'offers.offer_converted',    // order created; converted_order_id set
} as const;
export type OfferEventType = typeof OfferEventType[keyof typeof OfferEventType];
export type DomainEvent = { type: string; payload: Record<string, unknown> };

/** Who is acting in a negotiation. The buyer is listing_offers.buyer_user_id; the seller is the
 *  listing's seller, resolved via ListingService (never the listings repo — Law 11). */
export type OfferParty = 'buyer' | 'seller';
