-- apps/api/test/sql/reference-slices/labour_slice.sql · REFERENCE ONLY (not wired into tests).
-- A self-contained sketch of the labour SPINE (db/migrations/0008_labour.sql) — worker_profiles +
-- labour_bookings + booking_assignments + minimum_wages — plus their tenant RLS, WITHOUT the full
-- platform or the deferred tables (attendance/advances/insurance/crews/sardars/grievances/etc.). The
-- actual labour integration test builds its DB from the REAL db/migrations + db/seeds; this is a map.
--
-- Flow: a worker self-registers (one profile per user; age_verified_18 is a HARD assign gate). An employer
-- POSTS a booking — chk_dignity_floor makes a sub-minimum-wage offer IMPOSSIBLE in physics (the service
-- snapshots the floor from minimum_wages first). Workers are assigned (one row per worker), CONSENT, and
-- on completion WAGES SETTLE via the wallet (employer → worker). labour_bookings has a version column
-- (optimistic lock); the others have no version (lock FOR UPDATE).
BEGIN;
DROP TABLE IF EXISTS booking_assignments, labour_bookings, minimum_wages, worker_profiles, skills, admin_regions, lookup_values, users, tenants CASCADE;
DROP FUNCTION IF EXISTS current_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS uuid_generate_v7() CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE FUNCTION uuid_generate_v7() RETURNS uuid AS $$ SELECT gen_random_uuid() $$ LANGUAGE sql VOLATILE;
CREATE FUNCTION current_tenant_id() RETURNS uuid AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$ LANGUAGE sql STABLE;

CREATE TABLE tenants (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE users   (id uuid PRIMARY KEY, phone varchar(20) UNIQUE NOT NULL);
CREATE TABLE admin_regions (id uuid PRIMARY KEY, code varchar(20));
CREATE TABLE lookup_values (id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), type_code varchar(40), tenant_id uuid, code varchar(40), is_active boolean NOT NULL DEFAULT true);
CREATE TABLE skills (id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), code varchar(80) UNIQUE NOT NULL, default_name varchar(150) NOT NULL, tier smallint NOT NULL, is_active boolean NOT NULL DEFAULT true);

-- minimum_wages: GLOBAL master data (no tenant_id), effective-dated; the statutory DIGNITY FLOOR.
CREATE TABLE minimum_wages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), region_id uuid NOT NULL REFERENCES admin_regions(id),
  skill_level varchar(20) NOT NULL, daily_wage_minor bigint NOT NULL, hourly_wage_minor bigint,
  overtime_multiplier numeric(3,2) NOT NULL DEFAULT 1.5, effective_from date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
  UNIQUE (region_id, skill_level, effective_from));

CREATE TABLE worker_profiles (    -- one per user (user_id UNIQUE); NO version column
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), user_id uuid NOT NULL UNIQUE REFERENCES users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id), onboarded_by uuid REFERENCES users(id),
  age_verified_18 boolean NOT NULL DEFAULT false,             -- HARD assign gate
  village_region_id uuid REFERENCES admin_regions(id), travel_km integer NOT NULL DEFAULT 10,
  stay_away_ok varchar(20) NOT NULL DEFAULT 'same_day', min_wage_expectation_minor bigint, auto_accept_above_minor bigint,
  has_smartphone boolean NOT NULL DEFAULT true, emergency_contact_name varchar(150), emergency_contact_phone varchar(20),
  eshram_no varchar(20), rating_avg numeric(3,2), bookings_completed integer NOT NULL DEFAULT 0, no_show_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

CREATE TABLE labour_bookings (    -- HAS a version column → optimistic lock
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id), booking_no varchar(40) NOT NULL,
  employer_user_id uuid NOT NULL REFERENCES users(id), demand_type_id uuid NOT NULL REFERENCES lookup_values(id),
  task_skill_id uuid NOT NULL REFERENCES skills(id), workers_needed smallint NOT NULL DEFAULT 1 CHECK (workers_needed BETWEEN 1 AND 500),
  start_date date NOT NULL, end_date date NOT NULL, daily_hours numeric(4,2) NOT NULL DEFAULT 8,
  wage_kind varchar(15) NOT NULL DEFAULT 'per_day' CHECK (wage_kind IN ('per_day','per_hour','per_task')),
  wage_offered_minor bigint NOT NULL, min_wage_minor bigint NOT NULL, currency_code char(3) NOT NULL DEFAULT 'INR',
  overtime_rate_multiplier numeric(3,2) NOT NULL DEFAULT 1.5, women_only boolean NOT NULL DEFAULT false,
  farm_lat numeric(9,6) NOT NULL, farm_lng numeric(9,6) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'open', respond_by timestamptz, version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid,
  CONSTRAINT chk_dignity_floor CHECK (wage_offered_minor >= min_wage_minor),    -- THE RULE, in physics
  CONSTRAINT chk_dates CHECK (end_date >= start_date));

CREATE TABLE booking_assignments (   -- one row per worker per booking; NO version column
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), booking_id uuid NOT NULL REFERENCES labour_bookings(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id), worker_id uuid NOT NULL REFERENCES worker_profiles(id),
  status varchar(20) NOT NULL DEFAULT 'pending_worker', accepted_at timestamptz, voice_consent_media_id uuid, wage_minor bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid,
  UNIQUE (booking_id, worker_id));

-- RLS: every tenant table is private to its tenant (Law 1). minimum_wages/skills are global master data.
ALTER TABLE worker_profiles     ENABLE ROW LEVEL SECURITY; ALTER TABLE worker_profiles     FORCE ROW LEVEL SECURITY;
ALTER TABLE labour_bookings     ENABLE ROW LEVEL SECURITY; ALTER TABLE labour_bookings     FORCE ROW LEVEL SECURITY;
ALTER TABLE booking_assignments ENABLE ROW LEVEL SECURITY; ALTER TABLE booking_assignments FORCE ROW LEVEL SECURITY;
CREATE POLICY t_iso_workers     ON worker_profiles     USING (tenant_id = current_tenant_id());
CREATE POLICY t_iso_bookings    ON labour_bookings     USING (tenant_id = current_tenant_id());
CREATE POLICY t_iso_assignments ON booking_assignments USING (tenant_id = current_tenant_id());
COMMIT;
