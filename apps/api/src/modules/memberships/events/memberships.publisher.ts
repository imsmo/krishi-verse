// modules/memberships/events/memberships.publisher.ts
// Memberships do NOT use a separate publisher: integration events are written to the outbox in the SAME
// db transaction as the state change (Law 4), inside the services. This module re-exports the event-type
// catalogue for downstream consumers (e.g. the charge engine reading a member's platform_fee_bps_override).
export { MembershipEventType } from '../domain/memberships.events';
