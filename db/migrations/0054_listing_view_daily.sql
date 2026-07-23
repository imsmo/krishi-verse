-- ============================================================================
-- MIGRATION 0054 — LISTING VIEW DAILY BUCKETS (per-day view series for "Views by day", screen 115)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it in schema_migrations.
-- NEVER edit an applied migration — add a new numbered one.
--
-- WHY: 0051's listing_view_counts is a single TOTAL per listing (bounded by listing count) — perfect for the
-- "total views" number, but it carries no time dimension, so the seller analytics screen (115) could not show a
-- real day-by-day chart (it honestly degraded to "coming soon" rather than faking bars). This adds the COUNTED
-- DAILY read-model the stream-processor's `view_counter` consumer feeds alongside the total: exactly one row per
-- (tenant, listing, UTC day). Same off-band, hot-path-free pipeline as 0051 (POST /view → outbox → tailer →
-- consumer UPSERT). No synchronous read/aggregate cost is added to any render.
--
-- BOUNDED: one row per (tenant, listing, day). A listing live for D days holds D rows — bounded by listings×days,
-- never by impression volume (billions of views ⇒ a handful of rows per listing). Old rows are pruned by an ops
-- job (retention), not kept forever; analytics only reads a trailing window (last 7 days).
-- DEDUPED: the consumer runtime's idempotency store (keyed on the outbox event id) drops at-least-once
-- redeliveries BEFORE handle(), so a `+1` is counted once — same guarantee as the total counter.
-- DAY KEY: the bucket is the event's OCCURRED-AT date in UTC (a late-delivered event still lands in its real day),
-- computed in the consumer; never the processing wall-clock.
-- tenant-scoped + RLS (re-run idempotent pass below).
-- ============================================================================

CREATE TABLE listing_view_daily (
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  listing_id  uuid NOT NULL,                          -- listings.id (no FK: survives a hard listing delete for
                                                       -- historical analytics; bounded by listings anyway)
  day         date NOT NULL,                           -- the UTC calendar day of the counted impression
  views       bigint NOT NULL DEFAULT 0 CHECK (views >= 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, listing_id, day)
);

-- The analytics read reads a trailing window for ONE listing ordered by day; this index serves it directly.
CREATE INDEX idx_listing_view_daily_listing ON listing_view_daily(tenant_id, listing_id, day DESC);

-- RLS — re-run the idempotent tenant-isolation pass (0014/0020/0048/0049/0050/0051) for the new tenant table.
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
