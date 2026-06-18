// modules/tenancy/events/tenancy.publisher.ts
// Tenancy does NOT use a separate publisher: integration events are written to the outbox in the SAME db
// transaction as the state change (Law 4), inside the services. This module re-exports the event-type
// catalogue for downstream consumers (e.g. a SaaS-billing invoicer reacting to tenancy.subscribed).
export { TenancyEventType } from '../domain/tenancy.events';
