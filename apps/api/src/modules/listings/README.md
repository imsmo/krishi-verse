# listings — THE GOLD-STANDARD MODULE (copy this for every other module)

This is the reference implementation. Every one of the 31 modules copies this
shape and these patterns. If you are an AI agent or engineer building another
module, read this first.

## Files & what each demonstrates
- `domain/listing.state.ts` — the STATE MACHINE (Law 5). The only place status changes.
- `domain/listing.entity.ts` — pure domain logic, no framework, BIGINT money (Law 2), 95% unit-tested.
- `domain/listings.events.ts` — events this module publishes.
- `repositories/listing.repository.ts` — ALL SQL; tenant-scoped (Law 1), SHARD-routed (scale),
  reads on REPLICA / writes on PRIMARY (CQRS), optimistic locking via version.
- `services/listing.service.ts` — use-cases; transaction + OUTBOX in one txn (Law 4),
  IDEMPOTENCY (Law 3), QUOTA enforcement, price-history.
- `read-models/listing-search.read-model.ts` — CQRS read path on OpenSearch; reads never touch primary.
- `controllers/v1/*.controller.ts` — HTTP only: validate→authorize→delegate; guards for auth, RBAC, quota, idempotency.
- `events/handlers/*` — react to other modules' events, idempotently.
- `jobs/*` — cron/queue jobs owned here, run in apps/worker.
- `policies/*` — permission codes (resolved from DB, Law 6 dynamic RBAC).
- `__tests__/tenant-isolation.spec.ts` — MANDATORY CI gate in every module.

## Hard rules (also in CLAUDE.md)
1. No other module imports this module's repository — only `ListingService` or its events.
2. Status only changes through the state machine.
3. Money is BIGINT minor units, end to end.
4. Every write that others care about emits an outbox event in the same transaction.
5. Reads scale on the read-model; writes scale via the shard router.
