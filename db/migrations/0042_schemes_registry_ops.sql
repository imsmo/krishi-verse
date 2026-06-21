-- ============================================================================
-- MIGRATION 0042 — SCHEMES-REGISTRY-OPS (god-mode government-scheme master, Law 11)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it
-- in schema_migrations. NEVER edit an applied migration — add a new numbered one.
--
-- The government-scheme MASTER is already defined (0011): scheme_authorities (the issuing bodies) + schemes (the
-- 200+ central/state schemes, all as DATA, code-keyed, versioned). It is authored ONLY in apps/admin-api (Law 11);
-- the apps/api schemes module reads it READ-ONLY as a global catalogue and snapshots schemes.version into each
-- scheme_applications.scheme_version (rule-change integrity, PRD risk R18).
--
-- This migration adds ONLY god-mode operational scaffolding — it does NOT alter the master tables themselves:
--   scheme_registry_changes — append-only history of every authority/scheme mutation (created/updated/activated/
--                             deactivated/versioned) with old->new + reason + actor (audit_log also records each
--                             change in-tx). Covers both entity kinds via (entity_type, entity_id).
--   + two keyset-support indexes so the admin list endpoints page by (created_at, id) without OFFSET (Law 8/§5).
--
-- scheme_registry_changes is PLATFORM/god-mode (no tenant_id) => the idempotent RLS pass skips it; operated only
-- by the RLS-bypassing kv_admin role, every action audited. scheme_authorities + schemes have no tenant_id either
-- (global master) — not altered here.
-- ============================================================================

CREATE TABLE scheme_registry_changes (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  entity_type   varchar(16) NOT NULL CHECK (entity_type IN ('authority', 'scheme')),
  entity_id     uuid NOT NULL,                          -- scheme_authorities.id / schemes.id
  action        varchar(16) NOT NULL
                  CHECK (action IN ('created', 'updated', 'activated', 'deactivated', 'versioned')),
  old_value     jsonb,
  new_value     jsonb,
  reason        text NOT NULL,
  actor_user_id uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_scheme_registry_changes ON scheme_registry_changes(entity_type, entity_id, created_at DESC, id);

-- admin keyset paging support (the master tables predate the ops plane; these indexes back the list endpoints)
CREATE INDEX IF NOT EXISTS idx_scheme_authorities_admin ON scheme_authorities(created_at DESC, id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_schemes_admin ON schemes(created_at DESC, id) WHERE deleted_at IS NULL;
