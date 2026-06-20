-- ============================================================================
-- MIGRATION 0030 — BULK CSV IMPORT (core platform, PRD §7.1)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction.
-- Tenant-scoped, RLS-protected job tracking for bulk CSV imports (products/listings/…): a job points at an
-- uploaded CSV (object-store key), a worker streams + applies it row-by-row through a registered applier, and
-- per-row failures are recorded (capped) in bulk_import_errors. RLS is applied by re-running the idempotent
-- 0014/0027 tenant-isolation pass at the foot of this file.
-- ============================================================================

-- 1. bulk_import_jobs — one row per import; counters track progress; status drives the lifecycle machine.
CREATE TABLE bulk_import_jobs (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  import_type     varchar(40) NOT NULL,                 -- which applier handles the rows ('products', …)
  storage_key     varchar(500) NOT NULL,                -- object-store key of the uploaded CSV
  original_filename varchar(255),
  status          varchar(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','processing','completed','partially_completed','failed','cancelled')),
  total_rows      integer NOT NULL DEFAULT 0,
  processed_rows  integer NOT NULL DEFAULT 0,
  succeeded_rows  integer NOT NULL DEFAULT 0,
  failed_rows     integer NOT NULL DEFAULT 0,
  column_mapping  jsonb NOT NULL DEFAULT '{}',           -- optional CSV-header → field remap
  requested_by    uuid REFERENCES users(id),
  error_summary   text,                                  -- fatal/global error if the job itself failed
  started_at      timestamptz,
  finished_at     timestamptz
);
CALL add_std_columns('bulk_import_jobs');
CREATE INDEX idx_bulk_jobs_tenant ON bulk_import_jobs(tenant_id, created_at DESC, id);
CREATE INDEX idx_bulk_jobs_active ON bulk_import_jobs(tenant_id) WHERE status IN ('pending','processing');

-- 2. bulk_import_errors — per-row failures (capped per job by the app to bound write amplification). Append-only.
CREATE TABLE bulk_import_errors (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  job_id        uuid NOT NULL REFERENCES bulk_import_jobs(id),
  row_index     integer NOT NULL,                        -- 1-based data-row number (excludes header)
  error_code    varchar(60),
  error_message text,
  raw           jsonb,                                   -- the offending row (truncated), for the operator to fix
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_bulk_errors_job ON bulk_import_errors(tenant_id, job_id, row_index);

-- 3. RLS — re-run the idempotent tenant-isolation pass (0014/0027). It protects ONLY the newly-added tenant
--    tables (skips tables that already have a policy + the wallet/ledger tables).
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
