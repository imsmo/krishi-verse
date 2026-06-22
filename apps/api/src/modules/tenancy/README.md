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

## Self-serve plane (API-W3-05) — the in-tenant settings surface
A tenant admin (`tenant.settings`) manages its OWN tenant — never anyone else's, and never the parts
that are god-mode. Backed by `0002` (`tenants`, `tenant_domains`, `tenant_settings` + `setting_definitions`,
`tenant_features`) and `0015` (`usage_counters`).
- **Profile** (`domain/tenant.entity.ts`) — edit display/legal name, region, GSTIN/PAN/CIN/FSSAI, owner
  contact (validated + normalised). `status`, `slug`, `tenant_type`, `country`, `risk_score` are NOT in
  the patch type and are never written here (Law 11). `submit` signals the god-mode plane that onboarding
  is ready (emits `tenancy.tenant_onboarding_submitted`) without changing status.
- **Custom domains** (`domain/tenant-domain.entity.ts`) — add (TLS `pending`), list, make-primary (only a
  **verified** domain, demoting the prior primary in the same tx), remove. `UNIQUE(domain)` → a clash is a
  typed 409 (no domain hijack). Verification/TLS issuance is platform/automation, not self-settable.
- **Typed settings** (`domain/tenant-settings.entity.ts`) — upsert values against `setting_definitions`
  (`value_type` checked; only `scope='tenant'` keys are writable — platform/user keys refused, Law 11).
  Reads return defaults overlaid with overrides.
- **Read-only** — feature overrides (`tenant_features`) and current-period usage (`usage_counters`) are
  surfaced for the dashboard but never self-mutated (grants/metering are god-mode / core).

**Coordinates with admin-api `tenant-ops`**: lifecycle approve/suspend/archive, feature grants, quota
overrides, and provisioning live there (the authoritative `tenant_status` state machine). This module is
the in-tenant subset only — every read/write is scoped to `ctx.tenantId` (there is no `:tenantId` param,
so a tenant can only ever act on itself — no cross-tenant enumeration / IDOR).

## Endpoints
`POST /v1/plans` · `GET /v1/plans` · `GET /v1/plans/:id` · `POST /v1/plans/:id/active` (admin) ·
`POST /v1/subscriptions` (subscribe) · `GET /v1/subscriptions/current` (quota dashboard) ·
`GET /v1/subscriptions?box=mine|all` · `POST /v1/subscriptions/:id/change-plan` ·
`POST /v1/subscriptions/:id/cancel`.
Self-serve: `GET|PATCH /v1/tenants/me` · `POST /v1/tenants/me/submit` ·
`GET|POST /v1/tenants/me/domains` · `POST /v1/tenants/me/domains/:id/primary` · `DELETE …/domains/:id` ·
`GET|PUT /v1/tenant-settings` · `GET /v1/tenant-settings/features` · `GET /v1/tenant-settings/usage`
(all gated by the `tenancy` flag; writes need `tenant.settings` + an `Idempotency-Key`).

## Tests
Unit (`tenant.service.spec.ts`): subscription state machine + Plan/Subscription aggregates
(validation, priceFor, change/cancel/expire). `tenant-isolation.spec.ts`: SQL contract (subscriptions
bind tenant_id, plans are global, FOR UPDATE, no version, keyset, ON CONFLICT, usage read, SKIP LOCKED).
Integration (`tenancy.integration.spec.ts`, real Postgres + RLS + **quota**): create plan → subscribe →
the REAL `QuotaService` enforces the plan's limit (passes under, throws at the cap) → cancel removes the
limit (quota follows the subscription) → one-live guard → cross-tenant RLS denial.
Self-serve unit (`tenant-self-serve.spec.ts`): profile validation + status-immutability, domain hostname +
verified-before-primary, typed-setting + tenant-scope checks, read-only feature/usage models. Self-serve
integration (`tenant-self-serve.integration.spec.ts`, real Postgres + RLS): profile edit (status untouched)
+ outbox + audit, tenant-scoped setting upsert, **platform-scoped setting refused (Law 11)**, domain
add→verify→primary, and tenant B cannot see tenant A's domain.

## Deferred (flagged, not faked) — later wave
- **SaaS billing** — `saas_invoices` (invoice → collect → dunning), auto-renew, trials (`trialing` →
  `active`), and usage-limit alert notifications. The subscription's `price_minor` is recorded but not
  collected here; `renewal-invoices` / `trial-expiry` / `usage-limit-alerts` jobs are deferred stubs.
- **God-mode tenant lifecycle** — approve/suspend/archive/terminate, feature grants, quota overrides, and
  provisioning live in apps/admin-api `tenant-ops` (Law 11), not here.
