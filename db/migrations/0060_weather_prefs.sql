-- ============================================================================
-- MIGRATION 0060 — PER-USER WEATHER PREFERENCES (P1-4)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it in schema_migrations.
-- NEVER edit an applied migration — add a new numbered one.
--
-- The farmer's WEATHER-SPECIFIC preferences (screen 118): daily morning advisory on/off, weekly outlook on/off,
-- and a "severe alerts only" quiet switch. This is distinct from the generic notification CHANNEL prefs
-- (push/SMS/quiet-hours) which live in the communication module (P-04) and are linked from the screen — this table
-- holds only the weather advisory content toggles. One row per (tenant, user); PUT upserts. tenant-scoped + RLS.
-- ============================================================================

CREATE TABLE weather_prefs (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id          uuid NOT NULL REFERENCES tenants(id),
  user_id            uuid NOT NULL REFERENCES users(id),
  morning_advisory   boolean NOT NULL DEFAULT true,   -- daily morning weather advisory
  weekly_outlook     boolean NOT NULL DEFAULT true,   -- weekly 7-day outlook summary
  severe_only        boolean NOT NULL DEFAULT false   -- suppress routine advisories; only severe alerts
);
CALL add_std_columns('weather_prefs');
-- One live prefs row per (tenant, user) — the PUT endpoint upserts against this partial-unique key.
CREATE UNIQUE INDEX uq_weather_prefs_user ON weather_prefs(tenant_id, user_id) WHERE deleted_at IS NULL;

-- RLS — re-run the idempotent tenant-isolation pass for the new tenant table.
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
