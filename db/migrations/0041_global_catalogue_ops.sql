-- ============================================================================
-- MIGRATION 0041 — GLOBAL-CATALOGUE-OPS (god-mode platform master taxonomy, Law 11)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it
-- in schema_migrations. NEVER edit an applied migration — add a new numbered one.
--
-- The platform MASTER catalogue/taxonomy is already defined (0001 generic lookups, 0004 category tree). It is
-- authored ONLY in apps/admin-api (Law 11): the PLATFORM rows are the shared vocabulary every tenant inherits.
--   lookup_types / lookup_values  (0001) — controlled vocabularies; PLATFORM values are the rows with
--                                          tenant_id IS NULL (a tenant's own values, tenant_id set, are NOT
--                                          touched here — those belong to the tenant API).
--   categories                    (0004) — the 5-level hierarchical tree (ltree path + depth 1..5, no tenant_id).
--
-- This migration adds ONLY god-mode operational scaffolding — it does NOT alter the master tables themselves:
--   catalogue_changes  — append-only history of every platform-taxonomy mutation (created/updated/activated/
--                        deactivated/moved/renamed) with old->new + reason + actor (audit_log also records each
--                        change in-tx). Covers all three entity kinds via (entity_type, entity_id).
--   + two keyset-support indexes so the admin list endpoints page by (created_at, id) without OFFSET (Law 8/§5).
--
-- catalogue_changes is PLATFORM/god-mode (no tenant_id) => the idempotent RLS pass skips it; operated only by the
-- RLS-bypassing kv_admin role, every action audited. categories has no tenant_id; lookup_values' tenant_id is
-- pre-existing (RLS handled by 0001/0020) and only its PLATFORM rows (tenant_id IS NULL) are written here.
-- ============================================================================

CREATE TABLE catalogue_changes (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  entity_type   varchar(16) NOT NULL CHECK (entity_type IN ('lookup_type', 'lookup_value', 'category')),
  entity_id     varchar(120) NOT NULL,                 -- category/lookup_value uuid (as text) OR lookup_type.code
  action        varchar(16) NOT NULL
                  CHECK (action IN ('created', 'updated', 'activated', 'deactivated', 'moved', 'renamed')),
  old_value     jsonb,
  new_value     jsonb,
  reason        text NOT NULL,
  actor_user_id uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_catalogue_changes ON catalogue_changes(entity_type, entity_id, created_at DESC, id);

-- admin keyset paging support (the master tables predate the ops plane; these indexes back the list endpoints)
CREATE INDEX IF NOT EXISTS idx_categories_admin_list ON categories(created_at DESC, id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_lookup_values_admin
  ON lookup_values(type_code, created_at DESC, id) WHERE tenant_id IS NULL AND deleted_at IS NULL;
