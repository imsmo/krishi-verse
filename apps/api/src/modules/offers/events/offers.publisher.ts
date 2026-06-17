// modules/offers/events/offers.publisher.ts
// Offers do NOT use a separate publisher: integration events are written to the outbox in the SAME
// db transaction as the state change (Law 4), inside ListingOfferService.flush(). This module simply
// re-exports the event-type catalogue for downstream consumers (e.g. the orders-side handler that
// reacts to offers.offer_accepted to create the order). Kept as a stable import surface.
export { OfferEventType } from '../domain/offers.events';
