# memberships module (PRD M13 — subscription tiers & memberships)

Subscription **tiers** (free or wallet-paid) with a benefits bundle (free delivery, credit terms, a
sliding `platform_fee_bps_override`), and user **memberships**. A tenant admin defines tiers; a user
self-serves: **subscribe** (wallet-debited for paid tiers), **renew**, **cancel**; an expiry worker
lapses memberships past their paid period. Built to the `listings`/`identity` bar. Gated by the
`memberships` feature flag (default OFF).

## What it owns
- **Tiers** — `membership_tiers` (tenant-owned, or platform-standard when `tenant_id IS NULL`).
  `monthly_fee_minor` / `annual_fee_minor` (bigint), `benefits` jsonb (parsed/validated, never trusted),
  `platform_fee_bps_override`. Admin create / pause (`membership.manage`, always tenant-scoped — a tenant
  cannot create or mutate a platform-standard tier, Law 11). `UNIQUE(tenant_id, code)`.
- **Membership lifecycle** — `active → past_due → (active | cancelled | expired)`. State machine in
  `domain/user-membership.state.ts` (mirrors the `user_memberships.status` values). One **live**
  membership per user (guarded under the tx).
- **subscribe** — `POST /v1/memberships/subscribe` (self, Idempotency-Key). For a paid tier the **wallet
  is debited** (`userMain → platform fees`) — a ZERO-SUM, idempotent ledger txn (`membership:<id>`) via
  the wallet boundary (Law 2); the no-overdraw rule means the user must actually hold the balance. Free
  tiers move no money. Sets `current_period_end` one cycle out.
- **renew** — member-initiated: extends `current_period_end` by a cycle and charges the wallet again
  (idempotent per period). **cancel** — member or admin; ends the membership.
- **Expiry** — `membership-renewals` worker lapses live memberships past `current_period_end` (kv_relay
  pool, `FOR UPDATE SKIP LOCKED`, idempotent). It does NOT auto-charge (auto-renew needs a stored mandate
  — deferred).
- **benefits** — `GET /v1/memberships/me` returns the live membership + its tier's benefits (the charge
  engine reading `platform_fee_bps_override` for a member discount is the documented integration point).

## Security properties (threats considered)
- **Tenant isolation (Law 1)** — `tenant_id` in every query + RLS (backfilled by 0020 for these 0015
  tables). Platform-standard (NULL) tiers are visible to all tenants but mutable by none via the tenant
  API. The integration test proves tenant B sees zero of tenant A's memberships.
- **Money only via the wallet (Law 2)** — paid subscriptions debit the wallet (bigint minor units,
  zero-sum, idempotent); never a float, never a direct balance write. Insufficient balance fails closed.
- **Self-service, no IDOR** — subscribe/renew/cancel act on the CALLER (`ctx.userId`, never client-
  supplied); the tenant-wide list (`box=all`) needs `membership.manage`; an admin cancel is audited.
- **One live membership per user** — guarded under `FOR UPDATE` + a live-lookup, so a double-subscribe
  can't create two paid memberships (idempotency-key also dedupes client retries).
- **Authorization that throws** — tier CRUD needs `membership.manage`; no platform/`*` escalation.
- **Input validation** — zod `.strict()`; `benefits` re-validated in the domain (bounded credit days,
  minor amounts as integer strings); tier codes `[a-z0-9_]{2,40}`.
- **Concurrency** — no version columns → mutations lock the row `SELECT … FOR UPDATE`; status changes go
  only through the state machine. Lists are **keyset** (cursor, never OFFSET). Audit on admin actions.

## Endpoints
`POST /v1/membership-tiers` · `GET /v1/membership-tiers` · `GET /v1/membership-tiers/:id` ·
`POST /v1/membership-tiers/:id/active` (admin) · `POST /v1/memberships/subscribe` ·
`GET /v1/memberships/me` · `GET /v1/memberships?box=mine|all` · `POST /v1/memberships/:id/renew` ·
`POST /v1/memberships/:id/cancel`.

## Tests
Unit (`membership-tier.service.spec.ts`): state machine + aggregates (tier fee/benefits parsing,
subscribe/renew/cancel/expire). `tenant-isolation.spec.ts`: SQL contract (tenant_id everywhere, the
tenant-owned vs NULL-tier split, FOR UPDATE, no version, keyset, SKIP LOCKED). Integration
(`memberships.integration.spec.ts`, real Postgres + RLS + wallet): create paid + free tiers → subscribe
(wallet debited, zero-sum) → one-live guard → free subscribe (no debit) → cancel + re-subscribe →
expiry → cross-tenant RLS denial.

## Deferred (flagged, not faked) — later wave
- **Card-payment activation** — the alternative to wallet-debit (payment intent → `payments.payment_succeeded`
  → activate the membership) is left as a documented stub (`events/handlers/payment-succeeded.handler.ts`).
- **Auto-renew** — the expiry job lapses memberships but does NOT auto-charge; auto-debit needs a stored
  mandate/consent (deferred).
- **Member fee override at checkout (DONE)** — orders' `CheckoutService` calls
  `UserMembershipService.checkoutBenefits(tx, …)` and, behind the `memberships` flag, overrides the
  buyer-side charges for a live member: `freeDelivery` zeroes the delivery fee and
  `platform_fee_bps_override` replaces the default buyer platform fee (e.g. 2.5% → 1%). Proven by
  `apps/api/src/modules/orders/__tests__/checkout-member-benefits.integration.spec.ts`.

## Async glue (API-W4-01)
- **`MembershipPaymentSucceededHandler`** (`payments.payment_succeeded`, referenceType `membership`) — the
  card/gateway activation path: stamps the payment reference onto the membership and ensures it is live via
  `UserMembership.confirmPayment`. Idempotent — a no-op once a paymentId is set (or the membership is dead), so a
  relay re-delivery (or a subscription already activated by the synchronous wallet-debit path) changes nothing.
  Registered in the module's OnModuleInit.
