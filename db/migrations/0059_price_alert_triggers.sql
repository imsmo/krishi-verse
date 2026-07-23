-- ============================================================================
-- MIGRATION 0059 — PRICE-ALERT TRIGGER LOG (P1-3)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it in schema_migrations.
-- NEVER edit an applied migration — add a new numbered one.
--
-- An append-only log of every price-alert crossing that fired. Written IN the same tx as the price ingest that
-- caused it (Law 4, alongside the PriceAlertTriggered outbox event) so the count can never drift from the events.
-- Powers the farmer "triggered today / this week" stats on the alerts screen (screen 110) WITHOUT an N+1 scan of
-- the price history. tenant-scoped + user-owned + RLS. No PII — only ids + the observed modal (bigint minor, Law 2).
-- ============================================================================

CREATE TABLE price_alert_triggers (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  alert_id      uuid NOT NULL REFERENCES price_alerts(id),
  user_id       uuid NOT NULL REFERENCES users(id),       -- the alert owner (denormalised for the per-user count)
  product_id    uuid NOT NULL,
  region_id     uuid,
  direction     varchar(8) NOT NULL CHECK (direction IN ('above','below')),
  modal_minor   bigint NOT NULL,                          -- the observed modal price that crossed (minor units)
  threshold_minor bigint NOT NULL,                        -- the alert threshold at the time it fired
  triggered_at  timestamptz NOT NULL DEFAULT now()
);
CALL add_std_columns('price_alert_triggers');
-- Per-user recency scan (today / this week counts) — bounded by tenant+user, ordered by time.
CREATE INDEX idx_price_alert_triggers_user ON price_alert_triggers(tenant_id, user_id, triggered_at DESC);
CREATE INDEX idx_price_alert_triggers_alert ON price_alert_triggers(tenant_id, alert_id, triggered_at DESC);

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
