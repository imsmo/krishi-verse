-- apps/api/test/sql/reference-slices/logistics_slice.sql · REFERENCE ONLY (not wired into tests).
-- A self-contained, readable overview of the shipment-fulfilment tables (db/migrations 0007:
-- shipments + shipment_events) + their tenant RLS, WITHOUT the full 250-table platform. The actual
-- logistics integration test builds its DB from the REAL db/migrations + db/seeds
-- (test/integration-global-setup.js) — this file is a handy single-file sketch + local sandbox.
--
-- Flow: orders.order_confirmed auto-creates a shipment (status pending); ops/riders drive it to
-- out_for_delivery (a delivery OTP is generated, only its HASH stored); delivery verifies the OTP and
-- emits logistics.shipment_delivered → orders marks the order delivered. NO money moves here.
BEGIN;
DROP TABLE IF EXISTS shipment_events, shipments, users, tenants CASCADE;
DROP FUNCTION IF EXISTS current_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS uuid_generate_v7() CASCADE;
DROP TYPE IF EXISTS shipment_status CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE FUNCTION uuid_generate_v7() RETURNS uuid AS $$ SELECT gen_random_uuid() $$ LANGUAGE sql VOLATILE;
CREATE FUNCTION current_tenant_id() RETURNS uuid AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$ LANGUAGE sql STABLE;
CREATE TYPE shipment_status AS ENUM ('pending','assigned','pickup_scheduled','picked_up','in_transit','at_hub','out_for_delivery','delivered','failed','returned','cancelled');

CREATE TABLE tenants (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE users   (id uuid PRIMARY KEY, phone varchar(20) UNIQUE NOT NULL);

-- shipments — PARTITIONED by created_at in production (PK includes created_at). NO version column →
-- mutations lock FOR UPDATE. delivery_otp_hash stores ONLY the HMAC of the OTP (never plaintext).
CREATE TABLE shipments (
  id uuid NOT NULL DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id), order_id uuid NOT NULL,
  partner_id uuid, vehicle_id uuid, rider_user_id uuid REFERENCES users(id),
  status shipment_status NOT NULL DEFAULT 'pending', awb_no varchar(60),
  pickup_address_id uuid, drop_address_id uuid, scheduled_pickup_at timestamptz, scheduled_window_mins integer,
  picked_up_at timestamptz, delivered_at timestamptz, pickup_otp_hash varchar(128), delivery_otp_hash varchar(128),
  pod_media_id uuid, distance_km numeric(8,2), charge_minor bigint, cod_minor bigint, requires_cold_chain boolean NOT NULL DEFAULT false,
  route_id uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at));
CREATE INDEX idx_shipments_order ON shipments(tenant_id, order_id);   -- idempotent one-shipment-per-order lookup (migration 0023)

CREATE TABLE shipment_events (   -- immutable status/tracking trail
  id uuid NOT NULL DEFAULT uuid_generate_v7(), shipment_id uuid NOT NULL, tenant_id uuid NOT NULL,
  status shipment_status NOT NULL, lat numeric(9,6), lng numeric(9,6), note text,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (id, created_at));

-- RLS: both tables are tenant-private (the 0014 auto-pass covers them — they predate it).
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY; ALTER TABLE shipments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_shipments ON shipments USING (tenant_id IS NULL OR tenant_id = current_tenant_id());
ALTER TABLE shipment_events ENABLE ROW LEVEL SECURITY; ALTER TABLE shipment_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_shipment_events ON shipment_events USING (tenant_id IS NULL OR tenant_id = current_tenant_id());
COMMIT;
