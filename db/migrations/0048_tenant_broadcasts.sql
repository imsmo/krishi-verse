-- ============================================================================
-- MIGRATION 0048 — TENANT BROADCASTS (tenant→audience announcement send, API-W10)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it in schema_migrations.
-- NEVER edit an applied migration — add a new numbered one.
--
-- A tenant admin composes a message and sends it to an audience within their OWN tenant (all members, or one
-- role). The broadcast is recorded here; the actual per-recipient delivery flows through the EXISTING
-- notification spine (communication module) asynchronously via the outbox — one notification per recipient per
-- channel, honouring each user's preferences + quiet hours (Law 4/11). No money. tenant-scoped + RLS.
-- ============================================================================

CREATE TABLE tenant_broadcasts (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  audience_role_code varchar(60),                     -- NULL = all active tenant members; else a role code
  title            varchar(160) NOT NULL,
  body             text NOT NULL,
  status           varchar(16) NOT NULL DEFAULT 'queued'   -- queued|sending|sent|failed
                   CHECK (status IN ('queued','sending','sent','failed')),
  recipient_count  integer NOT NULL DEFAULT 0,
  sent_count       integer NOT NULL DEFAULT 0,
  failure_reason   text
);
CALL add_std_columns('tenant_broadcasts');
CREATE INDEX idx_tenant_broadcasts ON tenant_broadcasts(tenant_id, created_at DESC);

-- RLS — re-run the idempotent tenant-isolation pass (0014/0020) for the new tenant table.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT t.tablename
    FROM pg_tables t
    JOIN information_schema.columns c
      ON c.table_schema='public' AND c.table_name=t.tablename AND c.column_name='tenant_id'
    WHERE t.schemaname='public'
      AND t.tablename NOT IN ('wallet_accounts','ledger_entries','ledger_transactions','reconciliation_runs')
      AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=t.tablename)
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', r.tablename);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', r.tablename);
    EXECUTE format($f$CREATE POLICY tenant_isolation_%s ON %I
                     USING (tenant_id IS NULL OR tenant_id = current_tenant_id());$f$,
                   r.tablename, r.tablename);
  END LOOP;
END $$;

-- The notification EVENT + default templates the broadcast fan-out renders. Promotional priority, opt-out-able
-- (a tenant blast is not a critical/transactional alert). The admin's free text flows in via the payload
-- ({{title}}/{{body}}); push + in-app by default. Idempotent.
INSERT INTO notification_events (code, default_name, priority, default_channels, user_can_opt_out, batchable) VALUES
 ('tenant.broadcast', 'Announcement', 'promotional', '["push","inapp"]', true, false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO notification_templates (event_code, channel, language_code, tenant_id, subject, body, provider_template_ref, is_active) VALUES
 ('tenant.broadcast', 'push',  'en', NULL, '{{title}}', '{{body}}', NULL, true),
 ('tenant.broadcast', 'inapp', 'en', NULL, '{{title}}', '{{body}}', NULL, true)
ON CONFLICT (event_code, channel, language_code, tenant_id) DO NOTHING;
