# global-catalogue-ops (admin-api · god-mode plane, Law 11)

The platform **master taxonomy** module — the shared vocabulary every tenant's catalogue inherits. It owns two
registries, authored once and centrally by platform catalogue/data-governance staff:

- **Controlled vocabularies** — `lookup_types` (the vocabulary, e.g. `cert_type`, `cancel_reason`, `doc_type`) and
  their **PLATFORM** `lookup_values` (the rows with `tenant_id IS NULL`). A tenant's own values (`tenant_id` set)
  are NOT touched here — they belong to the tenant API (Law 11).
- **Category tree** — the 5-level hierarchical `categories` tree (ltree `path` + `depth` 1..5), with create /
  rename / flag-edit / **reparent (move)** / activate-deactivate.

> **Scope.** This plane is the lookup + category master the user asked for. The larger sibling surfaces —
> `attribute_definitions`/`attribute_options`, the `products` master, attribute synonyms, and
> `regulated_product_rules` — are deferred to follow-on sub-modules and are intentionally NOT stubbed here.

## Endpoints (URI-versioned, all admin-authed)
| Method | Path | Owner perm | Elevation |
|---|---|---|---|
| GET | `/v1/catalogue/lookup-types` · `/lookup-types/:code` | `catalogue.read` | — |
| POST | `/v1/catalogue/lookup-types` | `catalogue.manage` | **FIDO2 + step-up** (register a vocabulary) |
| PATCH | `/v1/catalogue/lookup-types/:code` | `catalogue.manage` | **FIDO2 + step-up** (rename) |
| GET | `/v1/catalogue/lookup-values?typeCode=…` · `/:id` · `/:id/history` | `catalogue.read` | — (keyset) |
| POST | `/v1/catalogue/lookup-values` | `catalogue.manage` | **FIDO2 + step-up** (add platform value) |
| PATCH | `/v1/catalogue/lookup-values/:id` | `catalogue.manage` | **FIDO2 + step-up** (name/meta/order — code immutable) |
| POST | `/v1/catalogue/lookup-values/:id/active` | `catalogue.manage` | **FIDO2 + step-up** (activate / retire) |
| GET | `/v1/catalogue/categories` · `/:id` · `/:id/children` · `/:id/history` | `catalogue.read` | — (keyset) |
| POST | `/v1/catalogue/categories` | `catalogue.manage` | **FIDO2 + step-up** (create node) |
| PATCH | `/v1/catalogue/categories/:id` | `catalogue.manage` | **FIDO2 + step-up** (rename + flags) |
| POST | `/v1/catalogue/categories/:id/move` | `catalogue.manage` | **FIDO2 + step-up** (reparent subtree) |
| POST | `/v1/catalogue/categories/:id/active` | `catalogue.manage` | **FIDO2 + step-up** (activate / retire) |

## What it owns
- **lookup_types / lookup_values** (0001) — controlled vocabularies; PLATFORM scope is enforced everywhere
  (`tenant_id IS NULL`). `code` is the STABLE, IMMUTABLE reference key (other tables FK by it, e.g.
  `certificates.cert_type_id → lookup_values(id)`); only `default_name`/`meta`/`sort_order` and `is_active` mutate.
  `meta` is bounded (≤50 keys, ≤4 KB, primitives only).
- **categories** (0004) — the tree. `code` is the materialised dotted path (`crops.cereals.wheat`) mirroring the
  ltree `path`; a node's leaf is a lowercase `[a-z0-9_]` slug. **Create** derives `code`/`path`/`depth` from the
  parent. **Move** reparents a node + its whole subtree in ONE bounded ltree splice (path/code/depth recomputed for
  every descendant in a single UPDATE — no per-row loop), guarded against cycles, depth-overflow, and oversized
  moves. Categories are never hard-deleted — **deactivate** retires a branch while keeping product FK references
  valid.
- **catalogue_changes** (0041) — append-only history of every mutation (created/updated/activated/deactivated/
  moved/renamed) with old→new + reason + actor, keyed by `(entity_type, entity_id)`; `audit_log` also records each
  change in-tx.

## Threats considered (§4 + Laws 8/11/12)
- **No stored XSS.** Display names are PLAIN TEXT — `assertPlainText` rejects `<`/`>` (no HTML) and control chars,
  so a master-taxonomy label can never carry markup a downstream tenant/app renderer might execute (unit-tested
  with a `<script>` payload). Codes/slugs are charset-bounded (ReDoS-safe anchored char classes).
- **No privilege escalation (Law 11).** `catalogue.manage`/`catalogue.read` are PLATFORM owner perms (roles
  `platform_catalogue_ops`/`platform_catalogue_viewer`); never `*`, never money/god, never tenant-assignable
  (unit-tested). A taxonomy change ripples into every tenant, so every mutation is `manage` + FIDO2 + step-up.
- **Tree integrity, fail-closed.** Depth capped at 5; a reparent cannot create a cycle (new parent ∉ {node ∪
  descendants}), cannot push any descendant past depth 5, and cannot move a subtree larger than the bound
  (write-amplification cap). A node can't be deactivated while it has active children, nor activated under an
  inactive parent (no orphaned/dangling branches). Unknown id/code → 404.
- **Platform isolation.** Lookup values are ALWAYS scoped `tenant_id IS NULL` on read and write — the ops plane
  can never read or mutate a tenant's private vocabulary. `categories`/`lookup_types`/`catalogue_changes` are
  god-mode (no `tenant_id`) → kv_admin-only.
- **Audit + bounded.** Every change commits a `catalogue_changes` row + an `audit_log` row IN THE SAME TX (actor,
  old→new, reason, ip, request_id); an illegal/no-op change writes nothing. `meta` bounded; zod `.strict()` rejects
  unknown keys; keyset pagination (never OFFSET), max LIMIT 100; mandatory reason on every mutation.

## apps/api integration note (read path — flagged, not built here)
This module is the WRITER of the platform master. The apps/api catalogue read path inherits these rows (active
PLATFORM lookup values + active categories the tenant has enabled via `tenant_categories`) — unchanged by this
plane, which only authors the master. No tenant-facing read is added here.

## Tests
- Unit (`global-catalogue-ops.spec.ts`): plain-text/code/slug/meta/sort guards; tree maths (derive code/depth,
  depth limit, cycle detection, bounded-move, leaf slug); entity mutation + no-op guards; owner-RBAC no-escalation/
  no-`*`; zod `.strict` DTOs; services' audit-in-tx + duplicate/404/parent-inactive/active-children/oversized-move
  fail-closed paths (pool/repo/audit mocked).
- Integration (`global-catalogue-ops.integration.spec.ts`, real Postgres, gated on `DATABASE_ADMIN_URL`): a lookup
  type + PLATFORM value (asserting `tenant_id IS NULL` + retire), and a category create→child→move-to-root→
  deactivate — asserting the recomputed `path`/`code`/`depth` over the ltree splice, the `catalogue_changes`
  timeline, and the `audit_log` rows.
