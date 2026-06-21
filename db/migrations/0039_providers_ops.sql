-- ============================================================================
-- MIGRATION 0039 — PROVIDERS-OPS (god-mode integration-provider registry ops, Law 11 + Law 12)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it
-- in schema_migrations. NEVER edit an applied migration — add a new numbered one.
--
-- The platform integration-provider registry (integration_providers from 0002 — Razorpay/MSG91/NDDB/…) is global
-- config that payments/payouts/comm reference. The providers-ops control plane (apps/admin-api) enables/disables a
-- provider platform-wide (Law 12: degrade gracefully when a provider is down) and reports credential-ref health.
-- This migration gives the registry what the ops plane needs:
--
--   integration_providers std columns — the registry was created in 0002 WITHOUT add_std_columns; add
--                                       created_at/updated_at/deleted_at/created_by/updated_by (+ the updated_at
--                                       trigger) so an enable/disable stamps WHO/WHEN. Existing rows default to now().
--   provider_changes                  — append-only history of enable/disable actions (old→new + reason + actor),
--                                       for the console timeline. (audit_log also records each change in-tx.)
--
-- Both are PLATFORM/god-mode (no tenant_id) ⇒ the idempotent RLS pass skips them; operated only by the RLS-
-- bypassing kv_admin role, every action audited. tenant_integrations (which holds the vault secret_ref) is NOT
-- touched here and its secret_ref is NEVER read by this module.
-- ============================================================================

CALL add_std_columns('integration_providers');

CREATE TABLE provider_changes (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  provider_code varchar(60) NOT NULL REFERENCES integration_providers(code),
  action        varchar(20) NOT NULL CHECK (action IN ('enabled', 'disabled')),
  old_value     jsonb,
  new_value     jsonb,
  reason        text NOT NULL,
  actor_user_id uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_provider_changes_code ON provider_changes(provider_code, created_at DESC, id);
