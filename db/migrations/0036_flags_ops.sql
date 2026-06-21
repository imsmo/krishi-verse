-- ============================================================================
-- MIGRATION 0036 — FLAGS-OPS (god-mode feature-flag operations, Law 10 + Law 11)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it
-- in schema_migrations. NEVER edit an applied migration — add a new numbered one.
--
-- The platform feature-flag control plane (apps/admin-api) operates the GLOBAL feature_flags
-- table from 0002 (the runtime evaluator lives in apps/api core/feature-flags). This migration
-- adds the two things the ops plane needs:
--
--   feature_flags.is_locked   — the KILL-SWITCH LOCK (Law 10). A kill disables the flag for
--                               everyone (is_enabled=false, which the evaluator already honours)
--                               AND sets is_locked=true so no operator can re-enable / change
--                               rollout / change targeting until it is explicitly unlocked with a
--                               reason. The runtime evaluator ignores this column (it only reads
--                               is_enabled/rollout_pct/rules) — the lock is an admin-plane guard.
--   feature_flag_changes      — append-only per-flag change history (created/enabled/disabled/
--                               rollout_changed/targeting_changed/killed/unlocked) with old→new
--                               diffs + reason + actor, for the console timeline. (audit_log also
--                               records every change in-tx; this is the queryable per-flag view.)
--
-- feature_flags + feature_flag_changes are PLATFORM/god-mode tables: no tenant_id ⇒ the idempotent
-- RLS pass skips them (RLS is for tenant-scoped tables; these are operated by the RLS-bypassing
-- kv_admin role and every action is audited).
-- ============================================================================

ALTER TABLE feature_flags ADD COLUMN is_locked boolean NOT NULL DEFAULT false;

CREATE TABLE feature_flag_changes (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  flag_key      varchar(80) NOT NULL REFERENCES feature_flags(key),
  action        varchar(20) NOT NULL
                  CHECK (action IN ('created','enabled','disabled','rollout_changed','targeting_changed','killed','unlocked')),
  old_value     jsonb,
  new_value     jsonb,
  reason        text NOT NULL,
  actor_user_id uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_flag_changes_key ON feature_flag_changes(flag_key, created_at DESC, id);
