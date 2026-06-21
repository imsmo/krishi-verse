# schemes-registry-ops (admin-api · god-mode plane, Law 11)

The platform **government-scheme master** module — the authoritative WRITER of `scheme_authorities` (issuing
bodies) and `schemes` (the 200+ central/state schemes, all as DATA: code-keyed, versioned). The apps/api schemes
module reads this catalogue READ-ONLY and snapshots `schemes.version` into each `scheme_applications.scheme_version`
(rule-change integrity, PRD risk R18). Authored once, centrally, by platform government-programs staff.

## Endpoints (URI-versioned, all admin-authed)
| Method | Path | Owner perm | Elevation |
|---|---|---|---|
| GET | `/v1/schemes-registry/authorities` · `/authorities/:id` · `/authorities/:id/history` | `schemes.registry.read` | — (keyset) |
| POST | `/v1/schemes-registry/authorities` | `schemes.registry.manage` | **FIDO2 + step-up** (register a body) |
| PATCH | `/v1/schemes-registry/authorities/:id` | `schemes.registry.manage` | **FIDO2 + step-up** (rename / re-level / re-region) |
| GET | `/v1/schemes-registry/schemes` · `/schemes/:id` · `/schemes/:id/history` | `schemes.registry.read` | — (keyset) |
| GET | `/v1/schemes-registry/schemes/calendar` | `schemes.registry.read` | — (active schemes open on a date) |
| POST | `/v1/schemes-registry/schemes` | `schemes.registry.manage` | **FIDO2 + step-up** (create — INACTIVE) |
| PATCH | `/v1/schemes-registry/schemes/:id` | `schemes.registry.manage` | **FIDO2 + step-up** (meta — no version bump) |
| POST | `/v1/schemes-registry/schemes/:id/rules` | `schemes.registry.manage` | **FIDO2 + step-up** (eligibility/benefit/fee — BUMPS version) |
| POST | `/v1/schemes-registry/schemes/:id/window` | `schemes.registry.manage` | **FIDO2 + step-up** (application window) |
| POST | `/v1/schemes-registry/schemes/:id/active` | `schemes.registry.manage` | **FIDO2 + step-up** (activate / retire) |

## What it owns
- **scheme_authorities** (0011) — issuing bodies (`level` ∈ central/state/district/body, optional `region_id`).
  Renameable / re-levellable; never hard-deleted (schemes FK `authority_id`).
- **schemes** (0011) — the catalogue. `code` is the STABLE, IMMUTABLE key (UNIQUE; the read path + application
  snapshots reference it). A scheme is created **INACTIVE** (fail-safe: a half-configured scheme isn't live until
  explicitly activated). Mutations are split by snapshot impact:
  - **updateMeta** (`default_name`/`authority_id`/`category_id`/`source_url`) — classification; **no version bump**.
  - **updateRules** (`eligibility_rules`/`benefit_summary`/`required_doc_type_ids`/`applicable_region_ids`/
    `processing_fee_minor`) — changes WHO is eligible + the entitlement ⇒ **bumps `version` in place**, so
    already-submitted `scheme_applications` keep their snapshotted `scheme_version` while new ones snapshot the new
    one (PRD R18).
  - **setWindow** (`application_window` = `{opens:'MM-DD', closes:'MM-DD', season?}`) — WHEN to apply; **no version
    bump** (year-wrapping windows allowed: `opens > closes`).
  - **activate/deactivate** (`is_active`) — retire a scheme without hard-deleting (FK refs stay valid).
- **Window calendar** (`/schemes/calendar`) — active schemes whose window contains a given `MM-DD` (defaults to
  today, UTC; wrap-aware), keyset-paged.
- **scheme_registry_changes** (0042) — append-only history (created/updated/activated/deactivated/versioned) with
  old→new + reason + actor; `audit_log` also records each change in-tx.

## apps/api integration note (read path — flagged, not built here)
This module is the WRITER. The apps/api schemes module reads `schemes`/`scheme_authorities` as a READ-ONLY global
catalogue (`Scheme.rehydrate` with `processing_fee_minor` as BigInt) and snapshots `version` into
`scheme_applications.scheme_version` at submit. `processing_fee_minor` is the per-application fee the apps/api
collects via the wallet-service at application time (Law 2) — this plane only DEFINES the price, it never moves
money. admin-api only authors the master.

## Threats considered (§4 + Laws 2/8/11)
- **No stored XSS / unsafe links.** Names are PLAIN TEXT (`assertPlainText` rejects `<`/`>` + control chars);
  `source_url` must be a valid **http(s)** URL (rejects `javascript:`/`data:`). `code` is a ReDoS-safe anchored
  lowercase identifier. The machine-evaluable blobs (`benefit_summary`/`eligibility_rules`) are bounded (≤8 KB),
  non-empty objects; id arrays are uuid-validated + capped (docs ≤100, regions ≤2000).
- **Money correctness (Law 2).** `processing_fee_minor` is **bigint minor units** — accepted as a digit string →
  bigint (rejects float/negative), stored as bigint, emitted as a STRING in responses. Never a float; never moved
  here (definition only).
- **No privilege escalation (Law 11).** `schemes.registry.manage`/`schemes.registry.read` are PLATFORM owner perms
  (roles `platform_schemes_ops`/`platform_schemes_viewer`); never `*`, never money/god, never tenant-assignable
  (unit-tested). A master edit ripples into every tenant's scheme catalogue, so every mutation is `manage` + FIDO2
  + step-up.
- **Referential integrity, fail-closed.** `authority_id` is FK-checked against `scheme_authorities` (→404);
  `category_id` must be an ACTIVE PLATFORM `scheme_category` lookup value (→422); duplicate `code` →409; unknown
  scheme/authority →404; any no-op edit →409 (writes nothing). Created INACTIVE so a partial config is never live.
- **Audit + bounded.** Every change commits a `scheme_registry_changes` row + an `audit_log` row IN THE SAME TX
  (actor, old→new, reason, ip, request_id). god-mode tables (no `tenant_id`) → kv_admin-only. zod `.strict()`;
  keyset pagination (never OFFSET), max LIMIT 100; mandatory reason on every mutation.

## Tests
- Unit (`schemes-registry-ops.spec.ts`): code/name/level/json/uuid/window/fee/url guards; entity mutation split
  (meta/window NO version bump, rules BUMPS version) + no-op guards + fee-as-string; owner-RBAC no-escalation/no-`*`;
  zod `.strict` DTOs; services FK-check + duplicate/category/404 fail-closed + audit-in-tx + version-bump + calendar
  default-date (pool/repo/audit mocked).
- Integration (`schemes-registry-ops.integration.spec.ts`, real Postgres, gated on `DATABASE_ADMIN_URL`):
  authority→scheme(inactive,v1)→rule version-bump→window→activate against the SEEDED `scheme_category` lookup —
  asserting the version increment, fee as bigint, window persistence + calendar surfacing, the
  `scheme_registry_changes` timeline, and the `audit_log` rows.
