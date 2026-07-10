# ADR-0001: Monorepo + Modular Monolith + 3 satellite services
Status: Accepted (June 2026)
Decision: One pnpm/turbo monorepo. Core API is a NestJS modular monolith whose
modules map 1:1 to PRD modules. Three things run separately from day 1:
wallet-service (money isolation), worker (queue consumers), outbox-relay.
Why not microservices day 1: 6-person team, 9-month MVP (Survival Guide).
Why not pure monolith: money isolation is non-negotiable; extraction recipe
must be proven from day 1.
Extraction recipe (Phase 2/3): move modules/<x> → apps/<x>-service, expose the
same contract from packages/contracts, route via gateway. No rewrites.

## Amendment (2026-07-10) — outbox relay runs in-process in apps/api for the pilot

Sprint S1 (KV-BL-063) resolved the "outbox relay execution" gap the S0 classification
memo raised (apps/worker/WORKER-RUNTIME.md, "Deferred: domain-handler jobs"):
OutboxDispatcher + runRelay() (core/outbox) existed and were tested, but nothing invoked
them at runtime, so cross-module event handlers (payments.payment_succeeded -> order
confirmed, orders.order_completed -> escrow release + notification fan-out, …) never
fired on their own.

Decision: for the pilot, **apps/api runs the dispatcher on its own in-process timer**
(`core/outbox/relay.runner.ts`, an `OnApplicationBootstrap`/`OnApplicationShutdown`
provider registered in `CoreModule`) — option (a) of the three the memo listed, not the
standalone `apps/outbox-relay` satellite this ADR originally named as a day-1 process.

Rationale:
- The `OUTBOX_HANDLER_REGISTRY` every module's handlers register into (OrdersModule,
  PaymentsModule, RealtimeFanoutRegistrar, …) already lives inside the api process. A
  standalone relay process would need to import that same domain wiring — effectively
  duplicating the api's DI graph — for no isolation benefit the relay actually needs.
- Safety does not depend on there being exactly one relay: `OutboxDispatcher.relayOne()`
  claims a single event with `FOR UPDATE SKIP LOCKED` (migration 0018's `kv_relay`
  BYPASSRLS role), so N api pods each running this timer race harmlessly for distinct
  rows — no leader election required, unlike apps/worker's advisory-lock jobs.
- This is an explicit, reviewed deviation from "outbox-relay runs separately from day 1"
  above — narrower in scope than money isolation (wallet-service) or queue consumption
  (worker), where an isolation failure is a launch blocker, not a pilot inconvenience.

Standalone extraction is deferred to GA, tracked as P0-9-follow-on: if/when relay
throughput needs to scale independently of api request traffic, move
`core/outbox/{outbox.dispatcher.ts,relay.poller.ts,relay.runner.ts}` into a dedicated
service the same way this ADR's extraction recipe describes for any `modules/<x>` —
`wallet-service` and `worker` already prove that recipe works end to end, so this is a
matter of when, not whether, it is possible.
