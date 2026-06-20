# ai-models-ops (admin-api, PRD §8.3) — god-mode AI model registry

The platform-owner home for the AI **model lifecycle** (Law 11: owner/platform operations live ONLY in
apps/admin-api). This is the authoritative WRITE side of the GLOBAL `ai_models` registry; the tenant API
(`apps/api/modules/ai-governance`) holds the read-only mirror that resolves which model serves a code and
records inferences against it.

## Why it lives here (Law 11)

`ai_models` is GLOBAL (no `tenant_id`) — a model promoted to `production` serves **every** tenant. Letting a
tenant mutate that would be cross-tenant privilege escalation, so the lifecycle is owner-only, in a separate
security realm: own JWT issuer, IP allowlist, FIDO2 hardware key, and JIT step-up re-auth.

## What it owns

- **Model registry write path** — `register` a new `code@version` (starts in `shadow`), `promote` along the
  lifecycle `shadow → canary → production → retired` (the sole state machine in `domain/ai-model.state.ts`,
  Law 5), and `retire`. `UNIQUE (code, version)` is enforced (duplicate → 409).
- **Threshold tuning** — adjust a model's `confidence_threshold` (the line below which apps/api routes an
  inference to human review). Old→new recorded.
- **Fairness reporting** — the stored monthly `fairness_audit` (written by apps/api's fairness job) plus a fresh
  30-day roll-up of the inference audit log (total / overridden / low-confidence + override rate).

## Surface (v1)

All under `AdminAuthGuard` + `OwnerPermissionsGuard`. Reads need `ai.model.read`; **mutations** additionally
require `HardwareKeyGuard` (FIDO2) + `StepUpReauthGuard` (recent re-auth) and `ai.model.manage`:

`GET /v1/ai/models`, `GET /v1/ai/models/:id`, `GET /v1/ai/models/:id/fairness`,
`POST /v1/ai/models` (register), `POST /v1/ai/models/:id/promote`, `PATCH /v1/ai/models/:id/threshold`.

## Threats considered (§4)

- **No privilege escalation (Law 11)** — owner roles (`super_admin`, `platform_ai_ops`, `platform_ai_auditor`)
  are defined in code here, NEVER in the tenant DB's `role_permissions`; a tenant admin can't reach this plane.
- **Auth / tokens** — self-contained HS256 verify, alg pinned (no alg-confusion), iss/aud/exp checked,
  constant-time signature compare. FIDO2 (`amr=hwk`) + step-up (`auth_time` freshness) enforced for mutations.
- **IP allowlist** — every route is gated by `IpAllowlistMiddleware` before auth; fail-closed (boot refuses a
  production config with no allowlist / no hardware-key / weak secret).
- **Audit** — every mutation writes an append-only `audit_log` row IN THE SAME TX (actor, action, old→new,
  reason, ip, request_id); a global interceptor adds a coarse access trail.
- **Input validation** — zod `.strict()` DTOs (reject unknown keys); thresholds bounded to `[0,1]`; code is an
  anchored `[a-z0-9_]{2,80}` (ReDoS-safe). Parameterised SQL only.
- **Concurrency** — `ai_models` has no version column → promote/tune lock the row `FOR UPDATE`.
- **State integrity** — status changes go only through the state machine (illegal transition → 409, no write).

## Note on cross-tenant RLS

`ai_models` is global (no `tenant_id`), so there is no per-tenant RLS to deny here — that property is proven for
the tenant-scoped governance tables in `apps/api/modules/ai-governance`'s integration test. This module's
integration test proves the lifecycle round-trip + audit rows + the unique-version guard against real Postgres.

## Tests

`__tests__/ai-models-ops.spec.ts` (lifecycle state machine; HS256 token verify incl. alg/iss/aud/exp/signature;
owner-role resolution; FIDO2 + step-up guards; registry/threshold services prove in-tx audit + state-machine
enforcement), `ai-models-ops.integration.spec.ts` (real Postgres: register → promote shadow→canary→production →
tune threshold → duplicate-version 409, with an audit row per mutation; runs when `DATABASE_URL` is set).
