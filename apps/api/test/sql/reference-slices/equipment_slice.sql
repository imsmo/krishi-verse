-- apps/api/test/sql/reference-slices/equipment_slice.sql · REFERENCE ONLY (not wired into tests).
-- A self-contained sketch of the equipment/CHC RENTAL spine (db/migrations/0010) — equipment_assets,
-- equipment_rates, equipment_bookings — plus tenant RLS, WITHOUT the full platform or deferred tables
-- (drones/maintenance). The real integration test builds its DB from the REAL db/migrations + db/seeds.
--
-- Flow: an owner lists an asset + rate cards; a renter requests a job (rate snapshotted), the owner quotes a
-- deposit, the renter confirms (advance ESCROWED: renter userMain → platform escrow), the operator starts
-- (OTP-gated) + completes (measured usage → total), and the owner SETTLES: escrow released to owner +
-- shortfall collected from renter (or unused hold refunded). No version columns → mutations lock FOR UPDATE.
BEGIN;
DROP TABLE IF EXISTS equipment_bookings, equipment_rates, equipment_assets, categories, users, tenants CASCADE;
DROP FUNCTION IF EXISTS current_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS uuid_generate_v7() CASCADE;
DROP TYPE IF EXISTS rental_status CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE FUNCTION uuid_generate_v7() RETURNS uuid AS $$ SELECT gen_random_uuid() $$ LANGUAGE sql VOLATILE;
CREATE FUNCTION current_tenant_id() RETURNS uuid AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$ LANGUAGE sql STABLE;
CREATE TYPE rental_status AS ENUM ('requested','quoted','confirmed','in_progress','completed','settled','cancelled','disputed');

CREATE TABLE tenants (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE users   (id uuid PRIMARY KEY, phone varchar(20) UNIQUE NOT NULL);
CREATE TABLE categories (id uuid PRIMARY KEY, code varchar(60));

CREATE TABLE equipment_assets (  -- owner-listed machinery; NO version column
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id), owner_user_id uuid NOT NULL REFERENCES users(id),
  category_id uuid NOT NULL REFERENCES categories(id), product_id uuid, reg_no varchar(20), year_of_mfg smallint, engine_hours numeric(10,1),
  hp_rating smallint, base_address_id uuid, service_radius_km integer NOT NULL DEFAULT 25, gps_device_ref varchar(100), status varchar(20) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

CREATE TABLE equipment_rates (   -- per-asset rate card; rate_minor is bigint minor units
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), asset_id uuid NOT NULL REFERENCES equipment_assets(id),
  rate_basis varchar(15) NOT NULL CHECK (rate_basis IN ('per_hour','per_acre','per_day','per_job','per_km')),
  rate_minor bigint NOT NULL, includes_operator boolean NOT NULL DEFAULT true, includes_fuel boolean NOT NULL DEFAULT false,
  effective_from date NOT NULL DEFAULT CURRENT_DATE, effective_to date,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid,
  UNIQUE (asset_id, rate_basis, effective_from));

CREATE TABLE equipment_bookings (  -- rental w/ escrowed advance + OTP-gated start. owner is JOINed from the asset.
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id), booking_no varchar(40) NOT NULL,
  renter_user_id uuid NOT NULL REFERENCES users(id), asset_id uuid NOT NULL REFERENCES equipment_assets(id), operator_user_id uuid REFERENCES users(id),
  task_desc varchar(250), rate_basis varchar(15) NOT NULL, rate_minor bigint NOT NULL, est_quantity numeric(10,2) NOT NULL, actual_quantity numeric(10,2),
  area_gps_trace jsonb, scheduled_at timestamptz NOT NULL, status rental_status NOT NULL DEFAULT 'requested', advance_minor bigint NOT NULL DEFAULT 0,
  total_minor bigint, payment_id uuid, start_otp_hash varchar(128), started_at timestamptz, completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

-- RLS: every tenant table is private to its tenant (Law 1).
ALTER TABLE equipment_assets   ENABLE ROW LEVEL SECURITY; ALTER TABLE equipment_assets   FORCE ROW LEVEL SECURITY;
ALTER TABLE equipment_bookings ENABLE ROW LEVEL SECURITY; ALTER TABLE equipment_bookings FORCE ROW LEVEL SECURITY;
CREATE POLICY t_iso_assets   ON equipment_assets   USING (tenant_id = current_tenant_id());
CREATE POLICY t_iso_bookings ON equipment_bookings USING (tenant_id = current_tenant_id());
COMMIT;
