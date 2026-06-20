-- apps/api/test/sql/reference-slices/traceability_slice.sql · REFERENCE ONLY (not wired into tests).
-- A self-contained sketch of the traceability spine (db/migrations/0012 trace tables + 0028 trace_scan) —
-- trace_lots + trace_events (PARTITIONED) — plus tenant RLS and the SECURITY DEFINER public-scan function. The
-- real integration test builds its DB from the REAL db/migrations + db/seeds.
--
-- Flow: a farmer opens a lot (qr_token = public capability) → appends a hash-chained journey (each event_hash =
-- sha256(prevHash||lotId||code||meta)) → a consumer scans the QR with NO auth via trace_scan(token), which
-- bypasses RLS but returns ONLY a curated non-PII projection. trace_lots/trace_events are tenant-scoped + RLS.
BEGIN;
DROP TABLE IF EXISTS trace_events, trace_lots, listings, users, tenants CASCADE;
DROP FUNCTION IF EXISTS trace_scan(text) CASCADE; DROP FUNCTION IF EXISTS current_tenant_id() CASCADE; DROP FUNCTION IF EXISTS uuid_generate_v7() CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE FUNCTION uuid_generate_v7() RETURNS uuid AS $$ SELECT gen_random_uuid() $$ LANGUAGE sql VOLATILE;
CREATE FUNCTION current_tenant_id() RETURNS uuid AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$ LANGUAGE sql STABLE;

CREATE TABLE tenants (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE users   (id uuid PRIMARY KEY, phone varchar(20) UNIQUE NOT NULL);
CREATE TABLE listings (id uuid PRIMARY KEY DEFAULT uuid_generate_v7());

CREATE TABLE trace_lots (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id), listing_id uuid REFERENCES listings(id), qr_token varchar(40) UNIQUE NOT NULL,
  farmer_user_id uuid NOT NULL REFERENCES users(id), parcel_id uuid, crop_season_id uuid, declared_inputs jsonb NOT NULL DEFAULT '[]', certificate_ids jsonb NOT NULL DEFAULT '[]', blockchain_anchor varchar(120),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

CREATE TABLE trace_events (  -- PARTITIONED by created_at; append-only hash chain
  id bigserial, trace_lot_id uuid NOT NULL, tenant_id uuid NOT NULL, event_code varchar(40) NOT NULL, meta jsonb NOT NULL DEFAULT '{}', event_hash varchar(64), created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)) PARTITION BY RANGE (created_at);
CREATE TABLE trace_events_default PARTITION OF trace_events DEFAULT;
CREATE INDEX idx_trace_events_lot ON trace_events(trace_lot_id, created_at);

-- RLS: lots + events are private to their tenant (Law 1).
ALTER TABLE trace_lots   ENABLE ROW LEVEL SECURITY; ALTER TABLE trace_lots   FORCE ROW LEVEL SECURITY;
ALTER TABLE trace_events ENABLE ROW LEVEL SECURITY; ALTER TABLE trace_events FORCE ROW LEVEL SECURITY;
CREATE POLICY t_iso_lot ON trace_lots   USING (tenant_id = current_tenant_id());
CREATE POLICY t_iso_evt ON trace_events USING (tenant_id = current_tenant_id());

-- The single RLS-bypass escape hatch for the ANONYMOUS public QR scan: curated, non-PII projection by token.
CREATE OR REPLACE FUNCTION trace_scan(p_qr_token text) RETURNS jsonb LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT jsonb_build_object('qrToken', l.qr_token, 'listingId', l.listing_id, 'declaredInputs', l.declared_inputs, 'certificateIds', l.certificate_ids, 'anchored', (l.blockchain_anchor IS NOT NULL), 'createdAt', l.created_at,
    'events', COALESCE((SELECT jsonb_agg(jsonb_build_object('eventCode', e.event_code, 'meta', e.meta, 'at', e.created_at) ORDER BY e.created_at) FROM trace_events e WHERE e.trace_lot_id = l.id), '[]'::jsonb))
  FROM trace_lots l WHERE l.qr_token = p_qr_token AND l.deleted_at IS NULL;
$$;
COMMIT;
