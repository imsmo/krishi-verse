# cells-ops (admin-api · god-mode plane, Law 8 + Law 11 + Law 12)

The platform's **shard/cell routing directory** — the topology as data, and the most infra-sensitive plane. It
owns where every tenant's data physically lives:

- **cells** — a cell is a fully-independent stack (Aurora+Redis+OpenSearch+pods) per country/region. India never
  depends on Bangladesh; the cell is the **DPDP / data-residency boundary** (`core/cells`).
- **shards** — physical partitions within a cell that the tenant→shard hash (`core/sharding` `ShardRouter`) maps to.
- **tenant_placements** — the authoritative directory (tenant → cell + shard) the edge gateway + the in-app
  `cell-resolver`/`shard-router` read to route every request (Law 8/12).

## Endpoints (URI-versioned, all admin-authed)
| Method | Path | Owner perm | Elevation |
|---|---|---|---|
| GET | `/v1/cells/cells` · `/cells/:id` · `/cells/:id/history` | `cells.read` | — (keyset) |
| POST | `/v1/cells/cells` | `cells.manage` | **FIDO2 + step-up** (register a cell) |
| PATCH | `/v1/cells/cells/:id` | `cells.manage` | **FIDO2 + step-up** (meta) |
| POST | `/v1/cells/cells/:id/status` · `/default` · `/residency-lock` | `cells.manage` | **FIDO2 + step-up** |
| GET | `/v1/cells/shards` · `/shards/:id` · `/shards/:id/history` | `cells.read` | — (keyset) |
| POST | `/v1/cells/shards` | `cells.manage` | **FIDO2 + step-up** (register a shard) |
| PATCH | `/v1/cells/shards/:id` · POST `/shards/:id/status` | `cells.manage` | **FIDO2 + step-up** |
| GET | `/v1/cells/placements` · `/placements/:tenantId` | `cells.read` | — (the routing directory) |
| POST | `/v1/cells/placements` | `cells.manage` | **FIDO2 + step-up** (place a tenant) |
| POST | `/v1/cells/placements/:tenantId/move` | `cells.manage` | **FIDO2 + step-up** (reroute) |
| DELETE | `/v1/cells/placements/:tenantId` | `cells.manage` | **FIDO2 + step-up** (offboard) |
| GET | `/v1/cells/residency-report` | `cells.read` | — (per-country posture) |

## What it owns
- **cells / shards** (0043) — `code`/`country_code`/`shard_index` are IMMUTABLE structural keys. Status moves only
  through the node state machine (Law 5): `active ⇄ readonly`, `active → draining → retired`, `draining → active`;
  `retired` is terminal. Only `active` accepts placements. A node may be RETIRED only once empty (`placed_count=0`).
  A cell carries a per-country **default** (one landing cell per country, enforced by a partial unique index) and
  a **residency lock**.
- **tenant_placements** (0043) — the directory, keyed by `placed_tenant_id`. **place / move / remove** maintain
  `placed_count` on both the cell and shard atomically in the same tx. The directory is global (read before tenant
  context exists), so it is intentionally NOT RLS-scoped and has no cross-DB FK to `tenants` (it lives on the global
  directory shard at scale) — existence is enforced in the service.
- **cell_map_changes** (0043) — append-only history (created/updated/status_changed/placed/moved/removed) with
  old→new + reason + actor; `audit_log` records each change in-tx.

## apps/api integration note (read path — flagged, not built here)
This module is the WRITER of the topology. `core/sharding/ShardRouter` (FNV-1a tenant→shard, config `shard_count`)
and `core/cells/cell-resolver` are the READERS; at scale they resolve a tenant's physical cell+shard from this
directory (today they run single-cell/shard=0, so the directory is authoritative-but-dormant — turning on N
cells/shards is config + data, not a rewrite, per ADR-0007). admin-api only authors the map.

## Threats considered (§4 + Laws 8/11/12)
- **Fail-closed routing.** A misroute would put a tenant's data on the wrong stack / wrong country, so every
  placement guard THROWS: the target cell AND shard must be `active` (`acceptsPlacement`), the shard must belong to
  the target cell, a capped cell may not be overfilled, and an already-placed tenant can't be double-placed
  (use move). Unknown cell/shard/placement → 404.
- **Data residency (DPDP).** A residency-locked cell's tenants may **never** be moved across a country border —
  `move` throws `ResidencyViolationError` when either endpoint cell is locked and the countries differ (unit +
  integration tested with an IN→BD attempt). Unlocking a cell is a deliberate, separately-audited action.
- **No secret leakage (§4).** `shards.dsn_secret_ref` is a VAULT reference (path/ARN), validated to reject a raw
  connection string, and is **NEVER** returned — `Shard.toJSON` exposes only a `hasDsn` boolean, and the change
  record masks it as `***` (unit-tested that an ARN never appears in any output).
- **No privilege escalation (Law 11).** `cells.manage`/`cells.read` are PLATFORM owner perms (roles
  `platform_cells_ops`/`platform_cells_viewer`); never `*`, never money/god, never tenant-assignable (unit-tested).
  The topology governs every tenant, so every mutation is `manage` + FIDO2 + step-up.
- **Integrity + audit + bounded.** Status transitions only via the state machine; retire requires empty; one
  default cell per country (partial unique index); every change commits a `cell_map_changes` + `audit_log` row in
  the SAME tx; god-mode tables (no `tenant_id`; the directory uses `placed_tenant_id`) → kv_admin-only, RLS gate
  skips them; zod `.strict()`; keyset pagination (never OFFSET), max LIMIT 100; mandatory reason. No money in this
  plane (capacity/weight are counts).

## Tests
- Unit (`cells-ops.spec.ts`): node status state machine (legal/illegal/terminal); capacity + residency +
  accepts-placement guards (fail-closed); code/name/index/weight/dsn validation; `dsn_secret_ref` never leaving the
  entity (+ raw-DSN rejection + masking); owner-RBAC no-escalation/no-`*`; zod `.strict` DTOs; services'
  fail-closed routing (already-placed/mismatch/non-active/over-capacity/cross-residency/no-op/404) + retire-empty
  guard + audit-in-tx + counter bookkeeping (pool/repo/audit mocked).
- Integration (`cells-ops.integration.spec.ts`, real Postgres, gated on `DATABASE_ADMIN_URL`): register two
  same-country cells + shards → place a tenant → move within the country (allowed) → cross-residency move blocked
  (DPDP) → remove — asserting `placed_count` bookkeeping, the `cell_map_changes` timeline, and the `audit_log` rows.
