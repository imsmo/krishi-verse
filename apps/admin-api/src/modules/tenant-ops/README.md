# tenant-ops (admin-api · god-mode plane, Law 11)

The platform-driven **tenant lifecycle** ops module. The tenant API can request onboarding, but only this
god-mode plane **approves / suspends / archives** tenants and sets **per-tenant numeric limit overrides**. It
also serves platform-wide tenant **search** + a tenant **scorecard**. Mounts under `AdminCoreModule`
(admin-JWT auth, owner RBAC, FIDO2 + step-up elevation, IP allowlist, in-tx audit — all @Global).

## Endpoints (URI-versioned, all admin-authed)
| Method | Path | Owner perm | Elevation |
|---|---|---|---|
| GET | `/v1/tenants` | `tenant.read` | — (keyset search: q/status/riskMin) |
| GET | `/v1/tenants/:id` | `tenant.read` | — (scorecard: status, risk, subscription, live listings, open disputes, overrides) |
| POST | `/v1/tenants/:id/approve` | `tenant.manage` | **FIDO2 + step-up** |
| POST | `/v1/tenants/:id/suspend` | `tenant.manage` | **FIDO2 + step-up** |
| POST | `/v1/tenants/:id/archive` | `tenant.manage` | **FIDO2 + step-up** |
| PATCH | `/v1/tenants/:id/limits` | `tenant.manage` | **FIDO2 + step-up** |

## What it owns
- The `tenant_status` lifecycle state machine (`pending→trial→active→grace→suspended→archived→terminated`) —
  the authoritative owner (Law 5). approve (pending/trial→active, stamps `approved_at`), suspend (live→suspended,
  reversible), archive (any non-terminal→archived).
- Each mutation, in ONE ACID tx (Law 4): lock the row `FOR UPDATE` → state-machine transition → `UPDATE tenants`
  → append a `tenant_status_events` row → append an `audit_log` row (tenant_id NULL = platform action) — all
  commit atomically, or none do.
- Per-tenant numeric limit overrides in `tenant_limit_overrides` (migration 0032; bigint, -1 = unlimited; the
  QuotaService read-merge `override ?? plan_limits` lives in apps/api — admin-api owns the WRITE).

## Threats considered (§4)
- **No privilege escalation (Law 11).** `tenant.manage`/`tenant.read` are PLATFORM owner permissions defined in
  `core/rbac/owner-roles.ts`; they are never in the tenant DB's role_permissions, so a tenant_admin can never
  resolve them. Unit-tested: a tenant role → empty owner permission set.
- **JIT elevation.** Every consequential mutation requires a verified admin JWT + the `tenant.manage` owner perm
  + a FIDO2 hardware-key (`amr=hwk`) + a recent step-up re-auth. Guards THROW (never log).
- **Audit everything.** Every state change writes an `audit_log` row IN THE SAME TX (actor, action, old→new,
  reason, ip, request_id); the access interceptor additionally logs every read/write. A rejected transition
  writes nothing (atomic). Reason is mandatory on all mutations.
- **Fail closed / state machine.** Illegal transitions throw `IllegalTenantTransitionError` before any write;
  approve only from pending/trial; archived/terminated are near/terminal. A missing tenant is a typed 404.
- **Bounded + parameterised.** Keyset pagination (never OFFSET), max LIMIT 100, parameterised SQL only,
  `FOR UPDATE` row locks for concurrency. Money/limits are bigint as strings — never floated (Law 2). zod
  `.strict()` DTOs reject unknown keys.

## Tests
- Unit (`__tests__/tenant-ops.spec.ts`): state machine legal/illegal, entity guards, owner-RBAC + no-escalation,
  DTO validation, services prove audit-in-tx + 404. `impersonation-audit.spec.ts`: the audit-in-tx ordering
  invariant + nothing-written-on-reject.
- Integration (`tenant-ops.integration.spec.ts`, real Postgres, gated on `DATABASE_ADMIN_URL`): seed pending
  tenant → approve → suspend → limit-override → illegal-transition, asserting `tenants.status`,
  `tenant_status_events`, `audit_log`, and `tenant_limit_overrides` rows.
