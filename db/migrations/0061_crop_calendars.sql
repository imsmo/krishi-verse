-- ============================================================================
-- MIGRATION 0061 — CROP-AGRONOMY CALENDARS (P1-5)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it in schema_migrations.
-- NEVER edit an applied migration — add a new numbered one.
--
-- Editorial crop-agronomy calendars: for a crop + season (+ optional region), the standard growth-stage timeline
-- with per-stage day-offset ranges + an agronomy advisory. This is REFERENCE content (like mandis / weather
-- advisories) — NOT a per-farm personalised calendar (there is no per-parcel variety/sowing-date/moisture, so the
-- app never fabricates those). tenant_id NULL ⇒ a PLATFORM-global calendar visible to every tenant (RLS policy
-- allows tenant_id IS NULL); a tenant may add its own. Browsed read-only by the crop-hub. RLS on.
-- ============================================================================

CREATE TABLE crop_calendars (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id          uuid REFERENCES tenants(id),                 -- NULL ⇒ platform-global reference calendar
  crop_name          varchar(120) NOT NULL,
  season             varchar(12) NOT NULL CHECK (season IN ('kharif','rabi','zaid','perennial')),
  region_id          uuid REFERENCES admin_regions(id),           -- NULL ⇒ pan-India / not region-specific
  duration_days_min  int NOT NULL CHECK (duration_days_min >= 0),
  duration_days_max  int NOT NULL CHECK (duration_days_max >= duration_days_min),
  -- stages: ordered array of { "name": text, "dayFrom": int, "dayTo": int, "advisory": text }.
  -- day offsets are RELATIVE to sowing (the app shows the generic timeline; it does NOT compute a farmer's
  -- current stage because no per-farm sowing date exists — that stays honestly absent).
  stages             jsonb NOT NULL DEFAULT '[]'::jsonb,
  source             varchar(120),                                -- e.g. 'ICAR', 'state agri dept' (never fabricated)
  is_active          boolean NOT NULL DEFAULT true
);
CALL add_std_columns('crop_calendars');
-- Browse by crop/season/region; active only. Bounded lists.
CREATE INDEX idx_crop_calendars_browse ON crop_calendars(crop_name, season) WHERE is_active AND deleted_at IS NULL;
CREATE INDEX idx_crop_calendars_region ON crop_calendars(region_id) WHERE is_active AND deleted_at IS NULL;

-- RLS — re-run the idempotent tenant-isolation pass (policy allows tenant_id IS NULL ⇒ global rows visible to all).
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
