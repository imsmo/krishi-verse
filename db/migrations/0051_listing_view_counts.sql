-- ============================================================================
-- MIGRATION 0051 — LISTING VIEW COUNTS (per-impression "views" read-model, P1-15)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it in schema_migrations.
-- NEVER edit an applied migration — add a new numbered one.
--
-- WHY: listing + tenant analytics omit view-traffic because there was no high-volume event pipeline — the number
-- was never faked (see listing-analytics.read-model.ts). This migration lands the COUNTED read-model that the
-- stream-processor's `view_counter` consumer feeds off the event stream. The HOT PATH (rendering a listing) is
-- never touched: a view is an explicit, throttled `POST /v1/listings/:id/view` that drops ONE tiny outbox event
-- (`views.listing_viewed`); the tailer ships it to kv.views; the consumer UPSERTs the counter here, fully
-- off-band. No synchronous read/aggregate cost is added to any render.
--
-- BOUNDED: exactly ONE row per (tenant, listing) — an UPSERT increment, never a row-per-impression. The table
-- size is bounded by the listing count, not the impression count (billions of views ⇒ thousands of rows).
-- DEDUPED: redeliveries are deduped by the consumer runtime's idempotency store keyed on the outbox event id
-- (at-least-once delivery can re-send the same event after a crash; it's counted once). Per-unique-viewer
-- windowed dedup is a warehouse rollup (analytics-pipeline), intentionally NOT faked here.
-- tenant-scoped + RLS (re-run idempotent pass below).
-- ============================================================================

CREATE TABLE listing_view_counts (
  tenant_id      uuid NOT NULL REFERENCES tenants(id),
  listing_id     uuid NOT NULL,                          -- listings.id (no FK: the counter must survive a hard
                                                          -- listing delete for historical analytics; bounded by listings anyway)
  total_views    bigint NOT NULL DEFAULT 0 CHECK (total_views >= 0),
  last_viewed_at timestamptz,                            -- most recent counted impression (NULL until first view)
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, listing_id)
);

-- Tenant analytics sums view-traffic per tenant; this supports that scan without touching the listings table.
CREATE INDEX idx_listing_view_counts_tenant ON listing_view_counts(tenant_id);

-- RLS — re-run the idempotent tenant-isolation pass (0014/0020/0048/0049/0050) for the new tenant table.
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
