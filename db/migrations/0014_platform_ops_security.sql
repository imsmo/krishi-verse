-- ============================================================================
-- MIGRATION 0014 — PLATFORM OPS SECURITY
-- Source of truth: Database_Architecture/full_platform/13_platform_ops_security.sql (reproduced verbatim)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it
-- in schema_migrations. NEVER edit an applied migration — add a new numbered one.
-- ============================================================================

-- ============================================================================
-- FILE 13 — PLATFORM OPS & SECURITY (RUN LAST)
-- Outbox, audit, idempotency · automatic monthly partitions for ALL
-- partitioned tables · automatic RLS over EVERY table with tenant_id ·
-- database roles & append-only grants.
-- The automation here is the "dynamic" guarantee: any NEW table added in any
-- future module gets partition + RLS coverage by re-running these blocks.
-- ============================================================================

-- ---------- transactional outbox (single reliable exit door for events)
CREATE TABLE outbox_events (
  id             bigserial PRIMARY KEY,
  tenant_id      uuid,
  aggregate_type varchar(60) NOT NULL,
  aggregate_id   uuid NOT NULL,
  event_type     varchar(120) NOT NULL,               -- 'order.created','milk_bill.approved','outbreak.declared'
  payload        jsonb NOT NULL,
  status         varchar(15) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','failed')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  published_at   timestamptz
);
CREATE INDEX idx_outbox_pending ON outbox_events(id) WHERE status='pending';

-- ---------- audit log (append-only, partitioned)
CREATE TABLE audit_log (
  id          bigserial,
  tenant_id   uuid,
  actor_user_id uuid,
  actor_role  varchar(40),
  action      varchar(120) NOT NULL,
  entity_type varchar(60),
  entity_id   uuid,
  old_value   jsonb,
  new_value   jsonb,
  reason      text,
  ip          inet,
  user_agent  varchar(300),
  request_id  varchar(60),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_actor ON audit_log(actor_user_id, created_at DESC);

-- ---------- API idempotency
CREATE TABLE idempotency_keys (
  key         varchar(120) PRIMARY KEY,
  user_id     uuid,
  endpoint    varchar(200) NOT NULL,
  response_status integer,
  response_body jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '24 hours'
);
CREATE INDEX idx_idem_expiry ON idempotency_keys(expires_at);

-- ---------- scheduled-job bookkeeping (partition creation, archiving, recon)
CREATE TABLE ops_job_runs (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  job_code   varchar(80) NOT NULL,                    -- 'create_partitions','archive_partitions','hourly_recon','minwage_sync'
  status     varchar(15) NOT NULL DEFAULT 'running',
  detail     jsonb NOT NULL DEFAULT '{}',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX idx_ops_jobs ON ops_job_runs(job_code, started_at DESC);


-- ============================================================================
-- AUTOMATIC MONTHLY PARTITIONS — discovers every partitioned table dynamically.
-- Run now; schedule monthly (creates 3 months ahead). New partitioned tables
-- in future modules are covered automatically.
-- ============================================================================
CREATE OR REPLACE PROCEDURE ensure_partitions(p_months_ahead int DEFAULT 3) AS $$
DECLARE r record; m date; part_name text; key_col text;
BEGIN
  FOR r IN
    SELECT c.oid::regclass::text AS tbl,
           (SELECT attname FROM pg_attribute
             WHERE attrelid = c.oid
               AND attnum = (SELECT unnest(partattrs) FROM pg_partitioned_table WHERE partrelid = c.oid LIMIT 1)) AS keycol
    FROM pg_class c
    JOIN pg_partitioned_table pt ON pt.partrelid = c.oid
    WHERE c.relnamespace = 'public'::regnamespace
  LOOP
    FOR i IN 0..(11 + p_months_ahead) LOOP
      m := (date_trunc('month', now()) + (i || ' months')::interval)::date;
      part_name := replace(r.tbl, 'public.', '') || '_' || to_char(m, 'YYYY_MM');
      EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF %s FOR VALUES FROM (%L) TO (%L);',
                     part_name, r.tbl, m, (m + interval '1 month')::date);
    END LOOP;
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF %s DEFAULT;',
                   replace(r.tbl, 'public.', '') || '_default', r.tbl);
  END LOOP;
END $$ LANGUAGE plpgsql;

CALL ensure_partitions(3);

-- ============================================================================
-- AUTOMATIC ROW-LEVEL SECURITY — every table owning a tenant_id column gets
-- ENABLE + FORCE + tenant-isolation policy. Re-run after adding any module.
-- Global/master tables (no tenant_id) are intentionally outside RLS.
-- Wallet & ledger get a stricter regime below.
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
    -- NULL tenant_id rows = platform-global rows, visible to all tenants (read paths filter in app)
    EXECUTE format($f$CREATE POLICY tenant_isolation_%s ON %I
                     USING (tenant_id IS NULL OR tenant_id = current_tenant_id());$f$,
                   r.tablename, r.tablename);
  END LOOP;
END $$;

-- ============================================================================
-- DATABASE ROLES & GRANTS — least privilege, append-only physics
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='kv_app')      THEN CREATE ROLE kv_app NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='kv_wallet')   THEN CREATE ROLE kv_wallet NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='kv_admin')    THEN CREATE ROLE kv_admin NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='kv_readonly') THEN CREATE ROLE kv_readonly NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='kv_ingest')   THEN CREATE ROLE kv_ingest NOLOGIN; END IF;  -- mandi/weather pipelines
END $$;

GRANT USAGE ON SCHEMA public TO kv_app, kv_wallet, kv_admin, kv_readonly, kv_ingest;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO kv_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO kv_readonly;
GRANT ALL    ON ALL TABLES IN SCHEMA public TO kv_admin;
GRANT USAGE  ON ALL SEQUENCES IN SCHEMA public TO kv_app, kv_wallet, kv_admin, kv_ingest;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE ON TABLES TO kv_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO kv_readonly;

-- Append-only tables: history is physics, not policy
REVOKE UPDATE, DELETE ON
  bids, consents, audit_log, order_events, auction_events, shipment_events,
  ambassador_earnings, login_events, risk_events, trace_events, dbt_transfers,
  scheme_application_events, listing_price_history, cold_chain_logs,
  coupon_redemptions, ai_inferences, tenant_status_events, group_ledger_entries
FROM kv_app;

-- Outbox/notifications: insert + status-column updates only
REVOKE UPDATE, DELETE ON outbox_events, notifications FROM kv_app;
GRANT UPDATE (status, published_at) ON outbox_events TO kv_app;
GRANT UPDATE (status, sent_at, read_at, provider_msg_ref, cost_minor, batched_into) ON notifications TO kv_app;

-- Money: ONLY the wallet service touches the ledger
REVOKE ALL ON wallet_accounts, ledger_entries, ledger_transactions, reconciliation_runs FROM kv_app;
GRANT SELECT ON wallet_accounts, ledger_entries, ledger_transactions TO kv_app;   -- read balances/history
GRANT SELECT, INSERT ON ledger_entries, ledger_transactions TO kv_wallet;
GRANT SELECT, INSERT, UPDATE ON wallet_accounts, reconciliation_runs TO kv_wallet;
GRANT SELECT, INSERT, UPDATE ON payments, payouts, payout_batches TO kv_wallet;

-- Ingestion pipelines: write market/weather data only
GRANT SELECT, INSERT ON mandi_prices, price_predictions, weather_alerts, fx_rates TO kv_ingest;

-- ============================================================================
-- FINAL SANITY VIEWS (ops dashboards)
-- ============================================================================
CREATE OR REPLACE VIEW v_tables_without_rls AS
SELECT t.tablename
FROM pg_tables t
JOIN information_schema.columns c
  ON c.table_schema='public' AND c.table_name=t.tablename AND c.column_name='tenant_id'
WHERE t.schemaname='public'
  AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.tablename=t.tablename)
  AND t.tablename NOT IN ('wallet_accounts','ledger_entries','ledger_transactions','reconciliation_runs');
-- must always return ZERO rows; alert if not.

CREATE OR REPLACE VIEW v_partitions_health AS
SELECT parent.relname AS table_name, count(child.relname) AS partition_count,
       max(child.relname) AS latest_partition
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child  ON pg_inherits.inhrelid  = child.oid
WHERE parent.relnamespace = 'public'::regnamespace
GROUP BY parent.relname;
