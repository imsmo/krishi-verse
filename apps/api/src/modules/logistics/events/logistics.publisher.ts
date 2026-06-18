// modules/logistics/events/logistics.publisher.ts
// Logistics does NOT use a separate publisher: integration events are written to the outbox in the
// SAME db transaction as the state change (Law 4), inside ShipmentService.flush(). This module
// re-exports the event-type catalogue for downstream consumers (e.g. orders' ShipmentDeliveredHandler,
// and the deferred notifications relay that SMSs the delivery OTP).
export { ShipmentEventType } from '../domain/logistics.events';
