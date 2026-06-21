-- ============================================================================
-- MIGRATION 0031 — STREAM PROCESSING (Phase 2 infra, apps/stream-processor)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction.
-- Backs the high-throughput stream tier: an outbox TAILER reads outbox_events by ascending id from a per-shard
-- checkpoint and publishes each to Kafka (append-only tail — it never mutates outbox_events.status, so it does
-- NOT contend with the in-process dispatcher; multiple independent readers each track their own offset). Kafka
-- consumers then do fan-out work (search/notify/project/fraud/analytics) idempotently: every (consumer,event_id)
-- is recorded so at-least-once redelivery is a no-op, and poison messages land in a dead-letter table.
--
-- These are INFRA tables operated by the stream-processor under the kv_relay BYPASSRLS role (migration 0018),
-- exactly like the relay — it processes events across every tenant. tenant_id is still stored on each row for
-- auditability/partition-pruning and the idempotent RLS pass still protects the tenant-scoped tables as
-- defense-in-depth. stream_ingest_checkpoint has no tenant_id (it's a global cursor) so the RLS pass skips it.
-- ============================================================================

-- 1. stream_ingest_checkpoint — the outbox tailer's high-water mark, one row per logical shard. The tailer
--    advances last_outbox_id only AFTER the batch is acknowledged by the broker (at-least-once: a crash
--    re-publishes the tail, and the consumers dedup). Global infra cursor (no tenant_id → RLS pass skips it).
CREATE TABLE stream_ingest_checkpoint (
  shard_no       integer PRIMARY KEY,
  last_outbox_id bigint  NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- 2. stream_processed_events — the idempotency ledger. One row per (consumer, outbox event) actually applied.
--    UNIQUE(consumer, event_id) makes a redelivered message a no-op (INSERT … ON CONFLICT DO NOTHING; if the
--    row already exists the consumer skips the side effect). tenant_id (nullable for platform events) is kept
--    for partition-pruned cleanup + audit. Bounded by retention (a purge job trims old rows).
CREATE TABLE stream_processed_events (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id   uuid REFERENCES tenants(id),                  -- nullable: platform-scoped events have no tenant
  consumer    varchar(60) NOT NULL,                         -- consumer group concern ('search_indexer', …)
  event_id    bigint NOT NULL,                              -- outbox_events.id that was processed
  event_type  varchar(120) NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (consumer, event_id)
);
CREATE INDEX idx_stream_processed_purge ON stream_processed_events(processed_at);
CREATE INDEX idx_stream_processed_tenant ON stream_processed_events(tenant_id, processed_at);

-- 3. stream_dead_letters — poison messages a consumer could not process after exhausting retries. Append-only,
--    capped write amplification (one row per terminally-failed (consumer,event_id)); an operator inspects +
--    replays. Stores the event envelope + last error, never secrets/PII beyond what the event already carries.
CREATE TABLE stream_dead_letters (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id     uuid REFERENCES tenants(id),
  consumer      varchar(60) NOT NULL,
  event_id      bigint NOT NULL,
  event_type    varchar(120) NOT NULL,
  payload       jsonb NOT NULL,
  error_code    varchar(80),
  error_message text,
  attempts      integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (consumer, event_id)
);
CREATE INDEX idx_stream_dlq_tenant ON stream_dead_letters(tenant_id, created_at DESC, id);

-- 4. stream_read_projections — the CQRS read-models the projection-builder consumer materialises off the event
--    stream (order/auction/listing summaries for dashboards + list views). Generic owned store: (projection,
--    entity_id) is the upsert key, doc holds the denormalised non-PII view, source_event_id guards stale writes
--    (only apply an event newer than the one last applied — out-of-order/redelivered events don't regress the
--    row). Tenant-scoped + RLS. Money inside doc stays string minor units (Law 2). Read APIs query this on the
--    replica with keyset pagination.
CREATE TABLE stream_read_projections (
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  projection      varchar(40) NOT NULL,                 -- 'order_summary','auction_summary','listing_card', …
  entity_id       varchar(64) NOT NULL,                 -- the aggregate id this row projects
  doc             jsonb NOT NULL,
  source_event_id bigint NOT NULL,                       -- last outbox id applied (monotonic guard)
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (projection, tenant_id, entity_id)
);
CREATE INDEX idx_stream_proj_list ON stream_read_projections(tenant_id, projection, updated_at DESC, entity_id);

-- 5. RLS — re-run the idempotent tenant-isolation pass (0014/0027). It protects ONLY newly-added tenant tables
--    (those with a tenant_id column and no existing policy); stream_ingest_checkpoint (no tenant_id) is skipped,
--    and the wallet/ledger tables stay excluded. The stream-processor uses kv_relay (BYPASSRLS) so it reads/
--    writes across tenants; the policy is defense-in-depth for any kv_app access.
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
