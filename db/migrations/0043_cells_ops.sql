-- ============================================================================
-- MIGRATION 0043 — CELLS-OPS (god-mode shard/cell routing DIRECTORY, Law 8 + Law 11 + Law 12)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it
-- in schema_migrations. NEVER edit an applied migration — add a new numbered one.
--
-- The platform's physical topology, as DATA. A CELL = a fully-independent stack (Aurora+Redis+OpenSearch+pods)
-- per country/region — India never depends on Bangladesh; this is the DPDP / foreign data-residency boundary
-- (core/cells). A SHARD = a physical partition within a cell that the tenant→shard hash (core/sharding
-- ShardRouter) maps to. tenant_placements is the authoritative DIRECTORY (tenant → cell + shard) the edge
-- gateway + the in-app cell-resolver / shard-router read to route every request (Law 8/12). Authored ONLY in
-- apps/admin-api (Law 11).
--
--   cells              — the cell map: code, country (residency anchor), a lifecycle status, the per-country
--                        default landing cell, a residency lock, and a soft tenant-capacity cap.
--   shards             — the shard map within a cell: shard_index (what the hash maps to), status, weight, and a
--                        VAULT REF to the connection string (dsn_secret_ref — NEVER the raw DSN/credentials).
--   tenant_placements  — the routing directory: ONE (cell, shard) per tenant. Key column is `placed_tenant_id`
--                        (NOT `tenant_id`) BY DESIGN: this is a GLOBAL directory read BEFORE tenant context
--                        exists (you read it to FIND the shard), so it is intentionally NOT RLS-scoped — and the
--                        `tenant_id`-named-column RLS gate (v_tables_without_rls) correctly skips it. At scale it
--                        lives on the global directory shard (core/sharding/directory-db), so there is no
--                        cross-DB FK to tenants — existence is enforced in the service layer.
--   cell_map_changes   — append-only history (created/updated/status_changed/placed/moved/removed) with old→new
--                        + reason + actor (audit_log also records each change in-tx).
--
-- All four are PLATFORM/god-mode (no `tenant_id` column) ⇒ the idempotent RLS pass skips them; operated only by
-- the RLS-bypassing kv_admin role, every action audited.
-- ============================================================================

CREATE TABLE cells (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  code             varchar(40) UNIQUE NOT NULL,         -- 'in-west-1','in-south-1'
  display_name     varchar(150) NOT NULL,
  country_code     char(2) NOT NULL REFERENCES countries(code),   -- residency anchor (DPDP / data sovereignty)
  status           varchar(12) NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'draining', 'readonly', 'retired')),
  is_default       boolean NOT NULL DEFAULT false,      -- the cell new tenants in this country land in
  residency_locked boolean NOT NULL DEFAULT true,       -- tenants here may NOT be moved to a cell of another country
  capacity_tenants integer,                             -- soft cap (NULL = unbounded); guarded on placement
  placed_count     integer NOT NULL DEFAULT 0,          -- denormalised active-placement count (capacity guard)
  notes            text
);
CALL add_std_columns('cells');
-- at most ONE default cell per country (the landing cell for new tenants)
CREATE UNIQUE INDEX idx_cells_default_per_country ON cells(country_code) WHERE is_default AND deleted_at IS NULL;
CREATE INDEX idx_cells_list ON cells(created_at DESC, id) WHERE deleted_at IS NULL;

CREATE TABLE shards (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  cell_id        uuid NOT NULL REFERENCES cells(id),
  shard_index    integer NOT NULL CHECK (shard_index >= 0),   -- the index the tenant→shard hash maps to
  status         varchar(12) NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'draining', 'readonly', 'retired')),
  dsn_secret_ref varchar(200),                          -- VAULT ref to the connection string — NEVER the raw DSN
  weight         smallint NOT NULL DEFAULT 100 CHECK (weight >= 0),   -- placement weighting
  placed_count   integer NOT NULL DEFAULT 0,
  notes          text,
  UNIQUE (cell_id, shard_index)
);
CALL add_std_columns('shards');
CREATE INDEX idx_shards_cell ON shards(cell_id, created_at DESC, id) WHERE deleted_at IS NULL;

CREATE TABLE tenant_placements (
  placed_tenant_id uuid PRIMARY KEY,                    -- routing key (one cell+shard per tenant); GLOBAL directory, no RLS by design
  cell_id          uuid NOT NULL REFERENCES cells(id),
  shard_id         uuid NOT NULL REFERENCES shards(id),
  pinned           boolean NOT NULL DEFAULT false       -- pinned ⇒ a future rebalancer must not auto-move it
);
CALL add_std_columns('tenant_placements');
CREATE INDEX idx_placements_cell ON tenant_placements(cell_id, created_at DESC, placed_tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_placements_shard ON tenant_placements(shard_id, created_at DESC, placed_tenant_id) WHERE deleted_at IS NULL;

CREATE TABLE cell_map_changes (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  entity_type   varchar(16) NOT NULL CHECK (entity_type IN ('cell', 'shard', 'placement')),
  entity_id     varchar(80) NOT NULL,                   -- cell/shard uuid OR placed_tenant_id
  action        varchar(20) NOT NULL
                  CHECK (action IN ('created', 'updated', 'status_changed', 'placed', 'moved', 'removed')),
  old_value     jsonb,
  new_value     jsonb,
  reason        text NOT NULL,
  actor_user_id uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cell_map_changes ON cell_map_changes(entity_type, entity_id, created_at DESC, id);
