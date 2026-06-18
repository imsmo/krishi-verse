// modules/requirements/events/requirements.publisher.ts
// Requirements do NOT use a separate publisher: integration events are written to the outbox in the
// SAME db transaction as the state change (Law 4), inside the services' flush(). This module re-exports
// the event-type catalogues for downstream consumers (e.g. the orders-side handler that reacts to
// requirements.quote_accepted to create the order).
export { RequirementEventType, ResponseEventType } from '../domain/requirements.events';
