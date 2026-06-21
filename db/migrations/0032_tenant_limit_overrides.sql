-- ============================================================================
-- MIGRATION 0032 — TENANT LIMIT OVERRIDES (god-mode tenant-ops, Law 11)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction.
-- Per-tenant NUMERIC quota overrides beyond the plan (anchor deals, pilots, abuse clamps). plan_limits (0002)
-- holds the per-PLAN quota; this table lets platform tenant-ops raise/lower a single limit for ONE tenant
-- without changing their plan. The QuotaService in apps/api resolves the effective limit as
-- (tenant override if present + not expired) ELSE (plan_limits) — that read-merge is apps/api wiring; admin-api
-- owns the WRITE here. -1 = unlimited (same convention as plan_limits.limit_value).
-- Tenant-scoped + RLS (the idempotent 0014/0027 pass protects it); admin-api writes via kv_admin (BYPASSRLS)
-- and audits every change, so RLS is defense-in-depth for any kv_app read.
-- ============================================================================

CREATE TABLE tenant_limit_overrides (
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  limit_code  varchar(60) NOT NULL,            -- mirrors plan_limits.limit_code ('max_farmers','api_rph',…)
  limit_value bigint NOT NULL,                 -- -1 = unlimited; >=0 otherwise (CHECK below)
  reason      text NOT NULL,                   -- god-mode change must carry a reason (audit/§4)
  expires_at  timestamptz,                     -- NULL = permanent; else the override lapses back to the plan
  PRIMARY KEY (tenant_id, limit_code),
  CONSTRAINT chk_tlo_value CHECK (limit_value >= -1)
);
CALL add_std_columns('tenant_limit_overrides');
CREATE INDEX idx_tlo_active ON tenant_limit_overrides(tenant_id) WHERE deleted_at IS NULL;

-- RLS — re-run the idempotent tenant-isolation pass (0014/0027): protect this newly-added tenant table.
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
