// modules/reviews/events/reviews.publisher.ts
// Reviews do NOT use a separate publisher: integration events are written to the outbox in the SAME db
// transaction as the state change (Law 4), inside ReviewService.flush(). This module re-exports the
// event-type catalogue for downstream consumers (e.g. a future search-indexer or seller-notification).
export { ReviewEventType } from '../domain/reviews.events';
