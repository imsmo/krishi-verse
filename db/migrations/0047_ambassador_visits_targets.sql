-- ============================================================================
-- MIGRATION 0047 — AMBASSADOR field-ops: visit log + period targets (API-W9)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it in schema_migrations.
-- NEVER edit an applied migration — add a new numbered one.
--
-- The ambassador growth engine (0013) had profiles + commission plans + earnings + referrals but NO
-- field-activity log and NO goal-setting. API-W9 adds:
--   • ambassador_visits  — a geo-stamped record of a field visit an ambassador made (onboarding/training/
--     collection/follow-up). The visited party may not be a platform user yet (prospect), so visited_user_id
--     is nullable. Drives the "my visits" timeline + activity-based payout audits.
--   • ambassador_targets — a per-period (week/month) goal per metric (onboardings / sales_facilitated /
--     earnings) an admin sets for an ambassador; the leaderboard read-model compares actuals against it.
-- Both are tenant-scoped; RLS is applied by re-running the idempotent 0014/0020 tenant-isolation pass at the
-- foot of this file (it protects only the newly-added tenant tables; skips wallet/ledger + already-policied).
-- No money columns move here — commissions still flow only through ambassador_earnings → the weekly wallet
-- payout (Law 11). amount/target money values are bigint MINOR units (Law 2).
-- ============================================================================

-- 1. ambassador_visits — geo-stamped field-visit log (the ambassador is the actor; visited party optional).
CREATE TABLE ambassador_visits (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  ambassador_id   uuid NOT NULL REFERENCES ambassador_profiles(id),
  visited_user_id uuid REFERENCES users(id),            -- NULL = prospect not yet onboarded
  purpose         varchar(20) NOT NULL DEFAULT 'other'  -- onboarding|training|collection|followup|support|other
                  CHECK (purpose IN ('onboarding','training','collection','followup','support','other')),
  notes           text,
  lat             numeric(9,6),
  lng             numeric(9,6),
  visited_at      timestamptz NOT NULL DEFAULT now(),
  region_id       uuid REFERENCES admin_regions(id)
);
CALL add_std_columns('ambassador_visits');
CREATE INDEX idx_amb_visits_ambassador ON ambassador_visits(tenant_id, ambassador_id, visited_at DESC);

-- 2. ambassador_targets — a goal for one metric over one period (admin-set; the ambassador reads their own).
CREATE TABLE ambassador_targets (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  ambassador_id uuid NOT NULL REFERENCES ambassador_profiles(id),
  metric        varchar(24) NOT NULL                    -- onboardings|sales_facilitated|earnings_minor|visits
                CHECK (metric IN ('onboardings','sales_facilitated','earnings_minor','visits')),
  period_start  date NOT NULL,
  period_end    date NOT NULL,
  target_value  bigint NOT NULL CHECK (target_value >= 0),  -- count, or minor units for earnings_minor (Law 2)
  CHECK (period_end >= period_start),
  UNIQUE (ambassador_id, metric, period_start)
);
CALL add_std_columns('ambassador_targets');
CREATE INDEX idx_amb_targets_ambassador ON ambassador_targets(tenant_id, ambassador_id, period_start DESC);

-- 3. RLS — re-run the idempotent tenant-isolation pass (0014/0020). Protects ONLY the new tenant tables
--    (skips wallet/ledger + any table already carrying a policy).
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
