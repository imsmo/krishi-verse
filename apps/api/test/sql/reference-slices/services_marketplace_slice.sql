-- apps/api/test/sql/reference-slices/services_marketplace_slice.sql · REFERENCE ONLY (not wired into tests).
-- A self-contained sketch of the services-marketplace spine (db/migrations/0015) — service_offerings (provider-
-- owned, priced in bigint minor units) + service_bookings — plus tenant RLS. The real integration test builds
-- its DB from the REAL db/migrations + db/seeds (incl. 0020 RLS backfill + the seeded service_fee ledger type).
--
-- Flow: a provider lists a priced service (per_hour/day/unit/person/visit/fixed) and publishes it → a customer
-- requests a booking (the fee is SNAPSHOTTED from the offering at request time; per_person × guests) → the
-- provider accepts → starts → the customer completes-and-pays (customer userMain → provider userMain, zero-sum,
-- service_fee). The provider is NOT a column on service_bookings — it is JOINed from service_offerings, so the
-- payee/authz are always resolved server-side (anti-IDOR). categories are GLOBAL reference (no tenant_id).
BEGIN;
DROP TABLE IF EXISTS service_bookings, service_offerings, categories, users, tenants CASCADE;
DROP FUNCTION IF EXISTS current_tenant_id() CASCADE; DROP FUNCTION IF EXISTS uuid_generate_v7() CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE FUNCTION uuid_generate_v7() RETURNS uuid AS $$ SELECT gen_random_uuid() $$ LANGUAGE sql VOLATILE;
CREATE FUNCTION current_tenant_id() RETURNS uuid AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$ LANGUAGE sql STABLE;

CREATE TABLE tenants (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE users   (id uuid PRIMARY KEY, phone varchar(20) UNIQUE NOT NULL);
CREATE TABLE categories (id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), code varchar(60) NOT NULL, default_name varchar(200) NOT NULL);  -- GLOBAL (no tenant_id)

CREATE TABLE service_offerings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id), provider_user_id uuid NOT NULL REFERENCES users(id),
  category_id uuid NOT NULL REFERENCES categories(id), default_title varchar(200) NOT NULL, description text,
  pricing_model varchar(20) NOT NULL CHECK (pricing_model IN ('per_hour','per_day','per_unit','per_person','per_visit','fixed')),
  price_minor bigint NOT NULL CHECK (price_minor > 0), currency_code char(3) NOT NULL DEFAULT 'INR',
  capacity_per_slot integer, service_radius_km integer, address_id uuid,
  status varchar(12) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','paused','archived')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);
CREATE INDEX idx_services_browse ON service_offerings(tenant_id, category_id) WHERE status='published';

CREATE TABLE service_bookings (  -- NOTE: NO provider_user_id column → JOINed from service_offerings
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id), offering_id uuid NOT NULL REFERENCES service_offerings(id),
  customer_user_id uuid NOT NULL REFERENCES users(id), booking_no varchar(40) NOT NULL, starts_at timestamptz NOT NULL, ends_at timestamptz, guests integer NOT NULL DEFAULT 1,
  total_minor bigint NOT NULL CHECK (total_minor >= 0), status varchar(12) NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','confirmed','in_progress','completed','cancelled','disputed')),
  payment_id uuid, notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);
CREATE INDEX idx_service_bookings_customer ON service_bookings(tenant_id, customer_user_id, created_at DESC);

-- RLS: the tenant-scoped tables are private to their tenant (Law 1). categories are global → no RLS.
ALTER TABLE service_offerings ENABLE ROW LEVEL SECURITY; ALTER TABLE service_offerings FORCE ROW LEVEL SECURITY;
ALTER TABLE service_bookings  ENABLE ROW LEVEL SECURITY; ALTER TABLE service_bookings  FORCE ROW LEVEL SECURITY;
CREATE POLICY t_iso_so ON service_offerings USING (tenant_id IS NULL OR tenant_id = current_tenant_id());
CREATE POLICY t_iso_sb ON service_bookings  USING (tenant_id IS NULL OR tenant_id = current_tenant_id());
COMMIT;
