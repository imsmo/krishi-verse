// modules/disputes/events/disputes.publisher.ts
// Disputes do NOT use a separate publisher: integration events are written to the outbox in the SAME db
// transaction as the state change (Law 4), inside DisputeService. This module re-exports the event-type
// catalogue for downstream consumers (orders' DisputeOpenedHandler / DisputeResolvedHandler).
export { DisputeEventType } from '../domain/disputes.events';
