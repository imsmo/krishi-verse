# providers-ops (admin-api · god-mode plane, Law 11 + Law 12)

The platform **integration-provider registry** ops module. It governs the global `integration_providers` table
(0002 — Razorpay/RazorpayX/MSG91/NDDB/PFMS/…) that payments/payouts/comm reference, and reports **credential-ref
health** across tenants. Its one consequential write is the platform-wide **enable/disable** toggle: pull a failing
provider out of rotation so dependents degrade gracefully (Law 12). It never touches credentials — only the
registry status and vault-ref *counts*.

## Endpoints (URI-versioned, all admin-authed)
| Method | Path | Owner perm | Elevation |
|---|---|---|---|
| GET | `/v1/providers` · `/providers/:code` | `providers.read` | — (registry + health counts) |
| GET | `/v1/providers/health` | `providers.read` | — (health rollup + degraded flags) |
| GET | `/v1/providers/financial` | `providers.read` | — (payment/KYC money-path lens) |
| GET | `/v1/providers/:code/history` | `providers.read` | — (enable/disable timeline, keyset) |
| PATCH | `/v1/providers/:code` | `providers.manage` | **FIDO2 + step-up** (enable / disable) |

## What it owns
- **Registry** over `integration_providers` (0002 + 0039 std columns): list (filter by category / active), single +
  credential-ref health, and the **enable/disable toggle** — the one write. A no-op (already in the requested
  state) is rejected 409 so the trail only records real changes. Disabling a provider is the Law-12 control: the
  runtime (payments/comm) routes to alternatives / fails closed for that provider.
- **Credential-ref health** over `tenant_integrations`: per-provider **counts** of configured + active tenant
  integrations — derived cross-tenant (kv_admin bypasses RLS). The vault `secret_ref` is **never selected, never
  returned**.
- **Provider health monitor** (`/health`): every provider with coverage counts + a **degraded** flag (disabled
  but tenants still point at it → those integrations will fail until re-enabled/migrated). NOTE: live uptime /
  circuit-breaker state is owned by `core/resilience` + observability at runtime; this surface reports the
  *persisted configuration* health, not real-time latency (which this plane has no source for) — stated, not faked.
- **Financial-partners lens** (`/financial`): the money-path providers (payment + KYC categories) for the finance
  ops team.
- **Change history** over `provider_changes` (0039): append-only enabled/disabled with old→new + reason + actor.

## Threats considered (§4 + Law 11/12)
- **No secret leakage (§4 PII/secrets).** `tenant_integrations.secret_ref` (the vault ARN) is never selected by any
  query, never mapped into a DTO, never returned. The registry entity carries no secret field (unit-tested:
  `toJSON` keys are exactly code/defaultName/category/isActive/createdAt); the integration test asserts the ARN
  string never appears in any response.
- **No privilege escalation (Law 11).** `providers.manage`/`providers.read` are PLATFORM owner perms (roles
  `platform_providers_ops`/`platform_providers_viewer`); never `*`, never money/god, never tenant-assignable
  (unit-tested). The toggle is `manage` + FIDO2 + step-up (a global flip affects every tenant's payments/comm).
- **Audit.** Each toggle commits a `provider_changes` row + an `audit_log` row IN THE SAME TX (actor, old→new,
  reason, ip, request_id); a no-op / missing-provider writes nothing. Reads are access-logged by the @Global
  interceptor.
- **Fail closed / bounded.** Unknown provider → 404; unknown category filter → 422; zod `.strict()` rejects unknown
  keys; keyset pagination (never OFFSET), max LIMIT 100; mandatory reason on the toggle.
- **Global table, role-isolated.** `integration_providers` + `provider_changes` are platform/god-mode (no
  tenant_id) → kv_admin-only, audited; `verify-rls-coverage.js` is unaffected.

## Tests
- Unit (`providers-ops.spec.ts`): entity enable/disable + no-op 409; category validation; owner-RBAC +
  no-escalation/no-`*`; DTO validation; services proving audit-in-tx on toggle, 404s, the degraded-flag logic, and
  that no response shape carries a secret.
- Integration (`providers-ops.integration.spec.ts`, real Postgres, gated on `DATABASE_ADMIN_URL`): disable→enable a
  throwaway provider (is_active flips, `provider_changes` + `audit_log` rows, no-op rejected) and the credential-ref
  health counts a tenant_integration cross-tenant while the vault `secret_ref` NEVER appears in any output.
