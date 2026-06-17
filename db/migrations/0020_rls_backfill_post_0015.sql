-- ============================================================================
-- MIGRATION 0020 — RLS BACKFILL for tenant tables added AFTER 0014
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction.
-- The automatic tenant-RLS pass in 0014 only saw tables that existed at the time. Migration 0015
-- (audit additions) added several tenant_id tables — listing_offers, saved_items, saved_searches,
-- user_memberships, service_offerings, service_bookings, external_entity_refs, inbound_webhooks,
-- data_retention_policies, data_export_jobs, carbon_*, user_blocks, user_phone_changes — which
-- therefore have NO row-level-security policy. Re-run the EXACT 0014 pass: it is idempotent (skips
-- any table that already has a policy, and the wallet/ledger tables that run under kv_wallet), so it
-- protects only the newly-uncovered tenant tables. Closes the RLS gap (verify-rls-coverage).
-- ============================================================================
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
