-- apps/api/test/sql/reference-slices/livestock_slice.sql · REFERENCE ONLY (not wired into tests).
-- A self-contained sketch of the livestock SPINE (db/migrations/0009) — species/breeds master data, animals,
-- and the vet marketplace (vet_profiles + vet_services + vet_bookings) — plus tenant RLS, WITHOUT the full
-- platform or the deferred tables (health events/transfers/prescriptions/semen/insemination/outbreaks/dairy).
-- The actual integration test builds its DB from the REAL db/migrations + db/seeds; this is a map.
--
-- Flow: a farmer registers an animal; a vet self-registers + prices a service; the farmer books it (fee
-- snapshotted from the service price), the vet renders it, and the FARMER completes+pays → wallet moves
-- farmer → vet (txnType service_fee, zero-sum). No version columns → mutations lock FOR UPDATE.
BEGIN;
DROP TABLE IF EXISTS vet_bookings, vet_services, vet_profiles, animals, animal_breeds, animal_species, lookup_values, admin_regions, users, tenants CASCADE;
DROP FUNCTION IF EXISTS current_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS uuid_generate_v7() CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE FUNCTION uuid_generate_v7() RETURNS uuid AS $$ SELECT gen_random_uuid() $$ LANGUAGE sql VOLATILE;
CREATE FUNCTION current_tenant_id() RETURNS uuid AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$ LANGUAGE sql STABLE;

CREATE TABLE tenants (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE users   (id uuid PRIMARY KEY, phone varchar(20) UNIQUE NOT NULL);
CREATE TABLE admin_regions (id uuid PRIMARY KEY, code varchar(20));
CREATE TABLE lookup_values (id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), type_code varchar(40), tenant_id uuid, code varchar(40), is_active boolean NOT NULL DEFAULT true);

CREATE TABLE animal_species (id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), code varchar(40) UNIQUE NOT NULL, default_name varchar(100) NOT NULL, is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);
CREATE TABLE animal_breeds (id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), species_id uuid NOT NULL REFERENCES animal_species(id), code varchar(60) NOT NULL,
  default_name varchar(100) NOT NULL, is_indigenous boolean NOT NULL DEFAULT false, origin_region_id uuid REFERENCES admin_regions(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid, UNIQUE (species_id, code));

CREATE TABLE animals (   -- the asset registry (Pashu Aadhaar/INAPH); NO version column
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id), owner_user_id uuid NOT NULL REFERENCES users(id),
  species_id uuid NOT NULL REFERENCES animal_species(id), breed_id uuid REFERENCES animal_breeds(id), pashu_aadhaar varchar(12) UNIQUE,
  name varchar(100), sex varchar(10), dob_estimated date, parity smallint, lactation_stage varchar(20), current_yield_lpd numeric(6,2),
  pregnancy_status varchar(20), body_condition_score numeric(2,1), status varchar(20) NOT NULL DEFAULT 'active', acquired_via varchar(20),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

CREATE TABLE vet_profiles (   -- one per user (user_id UNIQUE)
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), user_id uuid NOT NULL UNIQUE REFERENCES users(id), tenant_id uuid REFERENCES tenants(id),
  registration_no varchar(60) NOT NULL, is_ai_technician boolean NOT NULL DEFAULT false, service_radius_km integer NOT NULL DEFAULT 25,
  base_region_id uuid REFERENCES admin_regions(id), rating_avg numeric(3,2),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

CREATE TABLE vet_services (   -- a vet's priced catalog; price_minor is bigint minor units
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), vet_id uuid NOT NULL REFERENCES vet_profiles(id), service_type_id uuid NOT NULL REFERENCES lookup_values(id),
  price_minor bigint NOT NULL, pricing_unit varchar(20) NOT NULL DEFAULT 'per_visit', is_emergency_available boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid, UNIQUE (vet_id, service_type_id));

CREATE TABLE vet_bookings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id), farmer_user_id uuid NOT NULL REFERENCES users(id),
  vet_id uuid NOT NULL REFERENCES vet_profiles(id), service_id uuid NOT NULL REFERENCES vet_services(id), animal_id uuid REFERENCES animals(id),
  urgency varchar(15) NOT NULL DEFAULT 'routine', mode varchar(15) NOT NULL DEFAULT 'visit', symptoms_text text, scheduled_at timestamptz,
  status varchar(20) NOT NULL DEFAULT 'requested', fee_minor bigint, completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

-- RLS: tenant tables are private to their tenant (Law 1). species/breeds/vet_services are global/vet-scoped master data.
ALTER TABLE animals      ENABLE ROW LEVEL SECURITY; ALTER TABLE animals      FORCE ROW LEVEL SECURITY;
ALTER TABLE vet_profiles ENABLE ROW LEVEL SECURITY; ALTER TABLE vet_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE vet_bookings ENABLE ROW LEVEL SECURITY; ALTER TABLE vet_bookings FORCE ROW LEVEL SECURITY;
CREATE POLICY t_iso_animals  ON animals      USING (tenant_id = current_tenant_id());
CREATE POLICY t_iso_vetprof  ON vet_profiles USING (tenant_id IS NULL OR tenant_id = current_tenant_id());
CREATE POLICY t_iso_vetbook  ON vet_bookings USING (tenant_id = current_tenant_id());
COMMIT;
