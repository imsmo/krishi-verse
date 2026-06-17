// modules/offers/domain/listing-offer.state.ts · the listing_offers.status state machine (Law 5).
// Mirrors the status values in db/migrations/0015_audit_additions.sql (listing_offers):
//   open | countered | accepted | rejected | expired | converted
import { DomainError } from '../../../shared/errors/app-error';

export const OFFER_STATUSES = ['open', 'countered', 'accepted', 'rejected', 'expired', 'converted'] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

const TRANSITIONS: Readonly<Record<OfferStatus, readonly OfferStatus[]>> = Object.freeze({
  open:      ['countered', 'accepted', 'rejected', 'expired'],
  countered: ['countered', 'accepted', 'rejected', 'expired'],   // ping-pong: either party re-counters
  accepted:  ['converted'],                                      // an order is created downstream (orders)
  rejected:  [],
  expired:   [],
  converted: [],
});

export class IllegalOfferTransitionError extends DomainError {
  constructor(from: string, to: string) { super('OFFER_ILLEGAL_TRANSITION', `Cannot move offer ${from}→${to}`, 409, { from, to }); }
}
export function canTransition(from: OfferStatus, to: OfferStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: OfferStatus, to: OfferStatus): void { if (!canTransition(from, to)) throw new IllegalOfferTransitionError(from, to); }
/** A negotiation is live (can be countered/accepted/rejected/expired) only while open or countered. */
export function isNegotiable(s: OfferStatus): boolean { return s === 'open' || s === 'countered'; }
export function isTerminal(s: OfferStatus): boolean { return s === 'rejected' || s === 'expired' || s === 'converted'; }
