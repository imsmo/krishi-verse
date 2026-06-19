-- apps/api/test/sql/reference-slices/land_soil_weather_slice.sql · REFERENCE ONLY (not wired into tests).
-- A self-contained sketch of the land-soil-weather spine (db/migrations/0010) — land_parcels, crop_seasons,
-- soil_tests — + the GLOBAL partitioned weather_alerts reference table, plus tenant RLS. The real integration
-- test builds its DB from the REAL db/migrations + db/seeds (incl. ensure_partitions). This is a map.
--
-- Flow: a farmer registers a parcel, tracks crop seasons (planned→sown→harvested, +abandoned), and records
-- soil tests; everyone browses regional weather advisories (ingested, global, partitioned by created_at).
-- No money. No version columns → mutations lock FOR UPDATE.
BEGIN;
DROP TABLE IF EXISTS weather_alerts, soil_tests, crop_seasons, land_parcels, lookup_values, admin_regions, products, units, users, tenants CASCADE;
DROP FUNCTION IF EXISTS current_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS uuid_generate_v7() CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE FUNCTION uuid_generate_v7() RETURNS uuid AS $$ SELECT gen_random_uuid() $$ LANGUAGE sql VOLATILE;
CREATE FUNCTION current_tenant_id() RETURNS uuid AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$ LANGUAGE sql STABLE;

CREATE TABLE tenants (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE users   (id uuid PRIMARY KEY, phone varchar(20) UNIQUE NOT NULL);
CREATE TABLE units   (code varchar(20) PRIMARY KEY);
CREATE TABLE products(id uuid PRIMARY KEY);
CREATE TABLE admin_regions (id uuid PRIMARY KEY, code varchar(20));
CREATE TABLE lookup_values (id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), type_code varchar(40), tenant_id uuid, code varchar(40), is_active boolean NOT NULL DEFAULT true);

CREATE TABLE land_parcels (  -- the farm registry; area numeric(10,4); NO version column
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id), owner_user_id uuid NOT NULL REFERENCES users(id),
  region_id uuid REFERENCES admin_regions(id), survey_no varchar(60), bhulekh_ref varchar(120), area_value numeric(10,4) NOT NULL,
  area_unit varchar(20) NOT NULL DEFAULT 'acre' REFERENCES units(code), irrigation_type_id uuid REFERENCES lookup_values(id), boundary_geojson jsonb,
  verification_status varchar(20) NOT NULL DEFAULT 'none', is_tenant_farmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

CREATE TABLE crop_seasons (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id), parcel_id uuid NOT NULL REFERENCES land_parcels(id),
  product_id uuid NOT NULL REFERENCES products(id), season varchar(20) NOT NULL, year smallint NOT NULL, sown_on date, expected_harvest date,
  expected_yield numeric(12,3), actual_yield numeric(12,3), status varchar(20) NOT NULL DEFAULT 'planned',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

CREATE TABLE soil_tests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id), parcel_id uuid NOT NULL REFERENCES land_parcels(id),
  lab_name varchar(200), shc_card_no varchar(60), sampled_on date NOT NULL, results jsonb NOT NULL, recommendations jsonb NOT NULL DEFAULT '{}', report_media_id uuid, valid_until date,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

CREATE TABLE weather_alerts (  -- GLOBAL region advisories (no tenant_id) → outside RLS; PARTITIONED by created_at
  id uuid NOT NULL DEFAULT uuid_generate_v7(), region_id uuid NOT NULL, alert_type_id uuid NOT NULL, severity varchar(15) NOT NULL,
  valid_from timestamptz NOT NULL, valid_to timestamptz NOT NULL, advisory_text_key varchar(200), payload jsonb NOT NULL DEFAULT '{}', source varchar(60) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (id, created_at)) PARTITION BY RANGE (created_at);
CREATE TABLE weather_alerts_default PARTITION OF weather_alerts DEFAULT;

-- RLS: the three tenant tables are private to their tenant (Law 1). weather_alerts is global → no RLS.
ALTER TABLE land_parcels ENABLE ROW LEVEL SECURITY; ALTER TABLE land_parcels FORCE ROW LEVEL SECURITY;
ALTER TABLE crop_seasons ENABLE ROW LEVEL SECURITY; ALTER TABLE crop_seasons FORCE ROW LEVEL SECURITY;
ALTER TABLE soil_tests   ENABLE ROW LEVEL SECURITY; ALTER TABLE soil_tests   FORCE ROW LEVEL SECURITY;
CREATE POLICY t_iso_lp ON land_parcels USING (tenant_id = current_tenant_id());
CREATE POLICY t_iso_cs ON crop_seasons USING (tenant_id = current_tenant_id());
CREATE POLICY t_iso_st ON soil_tests   USING (tenant_id = current_tenant_id());
COMMIT;
