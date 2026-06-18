# tenancy module (PRD §5 — SaaS plans, subscriptions, the quota foundation)

The SaaS control plane: a **global plan catalogue** (plans + their `plan_limits`) and tenant
**subscriptions**. The whole point is that **an active subscription is what core `QuotaService` resolves
a tenant's limits from** — so building this turns quota enforcement from latent into real. Built to the
`listings`/`identity` bar. Gated by the `tenancy` feature flag (default OFF).

## What it owns
- **Plans (global)** — `plans` + `plan_limits` (`limit_value -1 = unlimited`). NO `tenant_id`: the plan
  catalogue is platform config. Create/pause are **platform-admin only** (`plan.manage` = god-mode,
  Law 11) — a tenant can never mint or alter a plan, only browse public ones. `UNIQUE(code, version,
  country_code)` (versioned for grandfathering).
- **Subscriptions (tenant-scoped)** — `subscriptions`. State machine
  `trialing → active → (past_due ↔ active | paused | cancelled | expired)` (`domain/subscription.state.ts`,
  mirrors the enum). Subscribe starts **active** so quotas apply immediately. One **live** subscription
  per tenant (guarded under `FOR UPDATE`). subscribe / change-plan / cancel (now or at period end).
- **The quota link** — core `QuotaService` reads `subscriptions (status='active') ⋈ plan_limits` and
  current-month `usage_counters`. `GET /v1/subscriptions/current` is the dashboard: the active
  subscription + its plan limits + current usage.
- **Expiry** — the `grace-period` worker lapses subscriptions past `current_period_end` (incl.
  cancel-at-period-end) → `expired`, at which point quotas lapse (kv_relay, `FOR UPDATE SKIP LOCKED`,
  idempotent). It does NOT auto-charge (SaaS billing/dunning is deferred).

## Security properties (threats considered)
- **Tenant isolation (Law 1)** — `subscriptions` carry `tenant_id` + RLS (the integration test proves
  tenant B sees zero of tenant A's). Plans are intentionally global (platform config; no tenant_id).
- **No plan privilege escalation (Law 11)** — plan create/pause require `plan.manage` (super-admin
  god-mode); a tenant admin (`tenant.settings`) can manage only its OWN subscription, never the catalogue.
- **No IDOR** — subscriptions are read/mutated under the caller's tenant (RLS + `tenant_id` in every
  query); `subscriptions?box=all` (cross-tenant view) requires `plan.manage`.
- **No SaaS money here** — the subscription records its `price_minor` but collection is the deferred B2B
  billing flow (`saas_invoices`); marketplace money stays on the wallet boundary. Prices are bigint minor.
- **Input validation** — zod `.strict()`; plan limits are signed-integer strings (`-1` = unlimited),
  codes bounded (`[a-z0-9_]`); no float, no ReDoS. Audit on every admin action.
- **Concurrency** — no optimistic-lock column → mutations lock the row `SELECT … FOR UPDATE`; status
  changes go only through the state machine. Lists are **keyset** (cursor, never OFFSET); plan-limit
  loads are batched (no N+1).

## Endpoints
`POST /v1/plans` · `GET /v1/plans` · `GET /v1/plans/:id` · `POST /v1/plans/:id/active` (admin) ·
`POST /v1/subscriptions` (subscribe) · `GET /v1/subscriptions/current` (quota dashboard) ·
`GET /v1/subscriptions?box=mine|all` · `POST /v1/subscriptions/:id/change-plan` ·
`POST /v1/subscriptions/:id/cancel`.

## Tests
Unit (`tenant.service.spec.ts`): subscription state machine + Plan/Subscription aggregates
(validation, priceFor, change/cancel/expire). `tenant-isolation.spec.ts`: SQL contract (subscriptions
bind tenant_id, plans are global, FOR UPDATE, no version, keyset, ON CONFLICT, usage read, SKIP LOCKED).
Integration (`tenancy.integration.spec.ts`, real Postgres + RLS + **quota**): create plan → subscribe →
the REAL `QuotaService` enforces the plan's limit (passes under, throws at the cap) → cancel removes the
limit (quota follows the subscription) → one-live guard → cross-tenant RLS denial.

## Deferred (flagged, not faked) — later wave
- **Tenant CRUD / settings / custom domains / feature toggles** — the `tenants`, `tenant_settings`,
  `tenant_domains`, `tenant_features` scaffolds are out of this slice (tenant onboarding is a separate
  platform-admin surface); left unwired.
- **SaaS billing** — `saas_invoices` (invoice → collect → dunning), auto-renew, trials (`trialing` →
  `active`), and usage-limit alert notifications. The subscription's `price_minor` is recorded but not
  collected here; `renewal-invoices` / `trial-expiry` / `usage-limit-alerts` jobs are deferred stubs.
