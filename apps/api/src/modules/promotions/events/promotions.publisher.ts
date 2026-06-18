// modules/promotions/events/promotions.publisher.ts
// Promotions do NOT use a separate publisher: integration events are written to the outbox in the SAME
// db transaction as the state change (Law 4), inside the services. This module re-exports the event-type
// catalogue for downstream consumers (e.g. a future cashback/recharge-bonus wallet-credit handler).
export { PromotionEventType } from '../domain/promotions.events';
