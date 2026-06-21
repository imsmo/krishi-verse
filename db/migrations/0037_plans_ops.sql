-- ============================================================================
-- MIGRATION 0037 — PLANS-OPS (god-mode SaaS plan-catalogue operations, Law 11)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it
-- in schema_migrations. NEVER edit an applied migration — add a new numbered one.
--
-- The platform PLAN CATALOGUE (plans / features / plan_features / plan_limits from 0002) is global config
-- (no tenant_id) that billing-ops (subscriptions → saas_invoices) and the tenant QuotaService (plan_limits via
-- the active subscription) consume. The plans-ops control plane (apps/admin-api) is its authoritative WRITER.
-- This migration adds the two things the ops plane needs:
--
--   plans.status         — an explicit DRAFT → ACTIVE → ARCHIVED lifecycle. A new plan is created DRAFT (not
--                          sellable); only a published (active) plan should be offered. `is_active` stays the
--                          runtime/sellability flag the rest of the system already reads (active ⇒ is_active=true,
--                          draft/archived ⇒ is_active=false) — this column just disambiguates "never published"
--                          (draft) from "retired" (archived), which a single boolean can't. EXISTING plans default
--                          to 'active' (back-compat with the seeds + tenancy create path).
--   plan_changes         — append-only per-plan change history (created/versioned/published/archived/reactivated/
--                          price_changed/feature_set/limit_set/...) with old→new diffs + reason + actor, for the
--                          console timeline. (audit_log also records every change in-tx; this is the per-plan view.)
--
-- plans + plan_changes are PLATFORM/god-mode tables: no tenant_id ⇒ the idempotent RLS pass skips them (RLS is for
-- tenant-scoped tables; these are operated by the RLS-bypassing kv_admin role and every action is audited).
-- ============================================================================

ALTER TABLE plans ADD COLUMN status varchar(10) NOT NULL DEFAULT 'active'
  CHECK (status IN ('draft', 'active', 'archived'));

CREATE TABLE plan_changes (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  plan_id       uuid NOT NULL REFERENCES plans(id),
  action        varchar(20) NOT NULL
                  CHECK (action IN ('created','versioned','published','archived','reactivated',
                                    'price_changed','feature_set','feature_removed','limit_set','limit_removed','visibility_changed')),
  old_value     jsonb,
  new_value     jsonb,
  reason        text NOT NULL,
  actor_user_id uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_plan_changes_plan ON plan_changes(plan_id, created_at DESC, id);
