# plans-ops (admin-api · god-mode plane, Law 11)

The platform **SaaS plan-catalogue** control plane. It is the authoritative WRITER of the GLOBAL `plans` /
`plan_features` / `plan_limits` catalogue (0002) that **billing-ops** (subscriptions → `saas_invoices`) and the
tenant **QuotaService** (`plan_limits` resolved via the active subscription) consume. It rounds out the SaaS story:
create tiers, ramp pricing with version-based grandfathering, attach features + quota limits, and run anchor /
enterprise custom deals.

## Endpoints (URI-versioned, all admin-authed)
| Method | Path | Owner perm | Elevation |
|---|---|---|---|
| GET | `/v1/plans` · `/plans/:id` | `plans.read` | — (keyset list + detail w/ composition) |
| GET | `/v1/plans/features` | `plans.read` | — (platform feature catalogue) |
| GET | `/v1/plans/:id/history` | `plans.read` | — (change timeline, keyset) |
| POST | `/v1/plans` | `plans.manage` | **FIDO2 + step-up** (create, DRAFT) |
| PATCH | `/v1/plans/:id` | `plans.manage` | **FIDO2 + step-up** (publish/archive/reactivate) |
| PATCH | `/v1/plans/:id/pricing` | `plans.manage` | **FIDO2 + step-up** (set prices — draft only) |
| POST | `/v1/plans/:id/version` | `plans.manage` | **FIDO2 + step-up** (clone → new version w/ new prices) |
| PUT·DELETE | `/v1/plans/:id/features/:code` | `plans.manage` | **FIDO2 + step-up** (assign/remove feature — draft only) |
| PUT·DELETE | `/v1/plans/:id/limits/:code` | `plans.manage` | **FIDO2 + step-up** (set/remove quota limit — draft only) |

## What it owns
- **Plan CRUD + lifecycle** over `plans` (0002 + 0037 `status`): create a plan **DRAFT** (not sellable), then
  `publish` → `active`, `archive` → `archived`, `reactivate` → `active` via the state machine (Law 5). `status`
  disambiguates never-published (draft) from retired (archived); the runtime sellability flag `is_active` is kept
  in sync (active ⇒ true). Auto-assigns the next `version` for a `(code, country)`.
- **Pricing + versioning** (anchor deals): `setPrices` edits a **draft** plan's prices; once published, prices are
  **IMMUTABLE** (grandfathering — existing subscriptions keep their version). To change a live plan's price you
  `version` it: a new DRAFT `version+1` is created with new prices and the features/limits cloned, leaving current
  subscribers untouched. `isPublic=false` makes a private/custom (enterprise/govt) plan version.
- **Feature + limit assignment** over `plan_features` / `plan_limits`: attach included features (+per-plan config)
  and dynamic quota limits (`limit_value` bigint, `-1` = unlimited — the value QuotaService enforces). Composition
  is editable **only while draft** (same grandfathering rule); a feature code must exist in the platform `features`
  catalogue (FK-safe → typed 404).
- **Change history** over `plan_changes` (0037): append-only `created/versioned/published/archived/reactivated/
  price_changed/feature_set/limit_set/...` with old→new diffs + reason + actor, for the console timeline.

## Threats considered (§4 + Law 11)
- **No privilege escalation (Law 11).** `plans.manage`/`plans.read` are PLATFORM owner perms (roles
  `platform_plans_ops`/`platform_plans_viewer` = pricing/product); never tenant-assignable, no plane bleed
  (unit-tested). A tenant can never edit the global plan catalogue.
- **Money correctness (Law 2).** All prices are **bigint minor units** end to end (zod digit-string → bigint),
  never a JS float; negative prices rejected; limit values are bigint (`-1` unlimited).
- **Grandfathering / no silent repricing.** A published plan's prices AND composition are immutable — the only way
  to change a live tier is to create a new version, so existing subscriptions never shift under tenants. Enforced
  in the entity (`PlanImmutableError`) + the assignment service; unit + integration tested.
- **JIT elevation + audit.** Every mutation needs a verified admin JWT + the owner perm + FIDO2 hardware-key +
  step-up; guards THROW. Each change commits a `plan_changes` row + an `audit_log` row IN THE SAME TX (actor,
  old→new, reason, ip, request_id); an illegal transition / immutable edit / unknown feature writes nothing.
- **Fail closed / bounded.** Unknown plan → 404; unknown feature → 404; `(code, version, country)` uniqueness →
  409; codes/country/currency charset-validated (ReDoS-safe linear regexes); feature `config` size-capped; zod
  `.strict()` rejects unknown keys / floats / bad limit values; keyset pagination (never OFFSET), max LIMIT 100;
  mandatory reason on every mutation.
- **Global table, role-isolated.** `plans` + `plan_changes` have no `tenant_id` (platform/god-mode) → operated only
  by RLS-bypassing `kv_admin`, every action audited (consistent with the other god-mode ops tables;
  `verify-rls-coverage.js` confirms no tenant table is left unprotected).

## Tests
- Unit (`plans-ops.spec.ts`): lifecycle state machine + entity (publish/archive/reactivate; price immutability);
  validation helpers; owner-RBAC + no-escalation; DTO validation (money strings, `-1` limit, unknown keys);
  services proving change-row + audit-in-tx, version conflict 409, illegal-transition / immutable-edit / unknown-
  feature / missing-plan guards, and draft-only composition.
- Integration (`plans-ops.integration.spec.ts`, real Postgres, gated on `DATABASE_ADMIN_URL`): create→compose→
  publish→version→archive — asserting `plans` state + lifecycle, `plan_features`/`plan_limits`, that a published
  plan's composition is immutable, the v2 clone copied composition, the `plan_changes` timeline, and `audit_log`.
