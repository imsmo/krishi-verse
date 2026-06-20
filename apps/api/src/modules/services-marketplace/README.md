# services-marketplace (PRD M30)

A peer-to-peer **service marketplace**: a provider publishes priced service offerings; a customer books one;
the provider drives the lifecycle; on completion the **customer (the payer)** settles the fee through the
wallet boundary. Gated by the `services_marketplace` feature flag (default **OFF**).

## Scope (this build)

- **Offerings** — provider-owned catalogue. `create → publish → pause ↔ published → archive` (+ edit while
  not archived). Priced in **bigint minor units** (Law 2) under one of six models: `per_hour`, `per_day`,
  `per_unit`, `per_person`, `per_visit`, `fixed`. Browse is published-only.
- **Bookings** — `requested → confirmed → in_progress → completed` (+ cancel from requested/confirmed). The
  fee is **snapshotted from the offering at request time** (never client-supplied); `per_person` multiplies
  the unit price by `guests` with exact bigint math (no float drift). A customer cannot book their own
  offering.
- **Fee settlement (the money path)** — on `complete`, the customer confirms + pays: a **zero-sum,
  idempotent** `service_fee` wallet transfer, **customer `userMain` → provider `userMain`**, posted inside the
  same ACID tx as the state change (Law 2 + Law 4). Idempotency key `svcbook:<bookingId>`.

## Invariants (the laws this module leans on)

- **Law 1 / RLS** — `tenant_id` binds every query; `service_offerings` + `service_bookings` are RLS-protected
  (backfilled by migration `0020`). `categories` is global reference (read-only here, no RLS).
- **Law 2** — money only moves via `wallet.post`; amounts are bigint minor units; the fee is zero-sum.
- **Law 3** — `request` and `complete` are idempotent (Idempotency-Key header required at the controller).
- **Law 4** — domain events are written to the outbox in the same tx.
- **Law 5** — lifecycle lives in `domain/service-offering.state.ts` + `domain/service-booking.state.ts`.
- **Law 6** — authz **throws** (`ServicesForbiddenError`); reads 404 for non-parties (no cross-party IDOR).
- No version column → bookings + offerings lock `FOR UPDATE`. Lists are **keyset** (never OFFSET).

The booking's **provider is not a stored column** — it is JOINed from `service_offerings`, so the payee and
authz are always resolved server-side.

## Surface (v1, all under the `services_marketplace` flag)

Offerings (`service.offer`): `POST /v1/services/offerings` (Idempotency-Key), `GET` (box=`mine|browse|all`),
`GET /:id`, `PATCH /:id`, `POST /:id/{publish,pause,archive}`.

Bookings: `POST /v1/services/bookings` (`service.book`, Idempotency-Key), `GET` (box=`customer|provider|all`),
`GET /:id`, `POST /:id/{accept,start}` (`service.offer`, provider), `POST /:id/cancel` (either party),
`POST /:id/complete` (`service.book`, customer, Idempotency-Key).

## Permissions & roles (seeded `0004`)

- `service.offer` — list + manage own offerings + drive the booking lifecycle (provider side).
- `service.book` — request + complete-and-pay bookings (customer side).
- `booking.manage` — the cross-party admin (the `all` boxes).

## Deferred (not in this build)

Provider availability calendars / slot capacity enforcement; commission split on the fee; disputes on a
booking (`disputed` status reserved); reviews/ratings of providers; payment-intent (online) prepay vs the
wallet path; recurring bookings; geo radius matching beyond the stored `service_radius_km`; provider payout to
bank (uses the existing payouts spine when wired).

## Tests

- `__tests__/services-marketplace-domain.spec.ts` — pure invariants (price > 0, per_person bigint math, both
  state machines).
- `__tests__/service-offering.service.spec.ts` — quota + outbox on create, authz-throws, provider-only mutate.
- `__tests__/service-booking.service.spec.ts` — fee snapshot, can't-book-own, unpublished guard, zero-sum
  customer→provider fee, no-money-on-failure, 404 for non-parties.
- `__tests__/tenant-isolation.spec.ts` — tenant_id binding, FOR UPDATE, keyset, provider-via-JOIN (CI gate).
- `__tests__/services-marketplace.integration.spec.ts` — real Postgres: publish → request (snapshot) → accept
  → start → complete-and-pay (balances move by exactly the fee) → idempotent replay → RLS cross-tenant deny.
  Runs when `DATABASE_URL` is set (skipped otherwise).
