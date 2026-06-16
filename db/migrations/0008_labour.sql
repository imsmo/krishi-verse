-- ============================================================================
-- MIGRATION 0008 — LABOUR
-- Source of truth: Database_Architecture/full_platform/07_labour.sql (reproduced verbatim)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it
-- in schema_migrations. NEVER edit an applied migration — add a new numbered one.
-- ============================================================================

-- ============================================================================
-- FILE 07 — LABOUR MARKETPLACE (M28, FULL — PRD §31)
-- Workers, dynamic skills, crews, sardars, migrants, attendance, advances,
-- insurance, MGNREGA, safety, complaints. Dignity rules = DB constraints.
-- ============================================================================

CREATE TYPE booking_status AS ENUM ('draft','open','pending_worker','accepted','rejected','expired','in_progress','completed','paid','cancelled','disputed','no_show');
CREATE TYPE advance_status AS ENUM ('requested','approved','disbursed','partially_recovered','recovered','written_off','rejected');

-- ---------- dynamic skill taxonomy (PRD §31.6 ten-tier tree, as data)
CREATE TABLE skills (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  code         varchar(80) UNIQUE NOT NULL,           -- 'sowing','tractor_operator','grafting','drone_assistant','milking'
  default_name varchar(150) NOT NULL,
  tier         smallint NOT NULL CHECK (tier BETWEEN 1 AND 10),
  parent_id    uuid REFERENCES skills(id),
  wage_uplift_hint_minor bigint,                      -- '+₹100/day' marketing hint
  is_hazardous boolean NOT NULL DEFAULT false,        -- pesticide spraying → PPE rules
  is_active    boolean NOT NULL DEFAULT true
);
CALL add_std_columns('skills');

CREATE TABLE worker_profiles (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id         uuid NOT NULL UNIQUE REFERENCES users(id),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),       -- onboarding tenant
  onboarded_by    uuid REFERENCES users(id),
  age_verified_18 boolean NOT NULL DEFAULT false,             -- HARD RULE: app refuses booking if false
  village_region_id uuid REFERENCES admin_regions(id),
  travel_km       integer NOT NULL DEFAULT 10,
  stay_away_ok    varchar(20) NOT NULL DEFAULT 'same_day',    -- same_day|overnight|weekly|monthly (migrant ladder)
  min_wage_expectation_minor bigint,
  auto_accept_above_minor bigint,
  has_smartphone  boolean NOT NULL DEFAULT true,
  equipment_owned jsonb NOT NULL DEFAULT '[]',
  emergency_contact_name  varchar(150),
  emergency_contact_phone varchar(20),
  eshram_no       varchar(20),                                -- e-Shram registry
  rating_avg      numeric(3,2),
  bookings_completed integer NOT NULL DEFAULT 0,
  no_show_count   integer NOT NULL DEFAULT 0
);
CALL add_std_columns('worker_profiles');
CREATE INDEX idx_workers_tenant ON worker_profiles(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_workers_village ON worker_profiles(village_region_id);

CREATE TABLE worker_skills (
  worker_id   uuid NOT NULL REFERENCES worker_profiles(id),
  skill_id    uuid NOT NULL REFERENCES skills(id),
  level       varchar(15) NOT NULL DEFAULT 'self_declared' CHECK (level IN ('self_declared','peer_rated','certified')),
  cert_id     uuid REFERENCES certificates(id),
  years_exp   smallint,
  PRIMARY KEY (worker_id, skill_id)
);

CREATE TABLE worker_availability (
  worker_id    uuid NOT NULL REFERENCES worker_profiles(id),
  day          date NOT NULL,
  is_available boolean NOT NULL DEFAULT true,
  note         varchar(150),
  PRIMARY KEY (worker_id, day)
);

-- ---------- statutory wage floors (per state × skill level × date)
CREATE TABLE minimum_wages (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  region_id       uuid NOT NULL REFERENCES admin_regions(id),  -- state-level region
  skill_level     varchar(20) NOT NULL,               -- unskilled|semi_skilled|skilled|highly_skilled
  daily_wage_minor bigint NOT NULL,
  hourly_wage_minor bigint,
  overtime_multiplier numeric(3,2) NOT NULL DEFAULT 1.5,
  effective_from  date NOT NULL,
  source_notification varchar(300),
  UNIQUE (region_id, skill_level, effective_from)
);
CALL add_std_columns('minimum_wages');

-- ---------- sardar / crews (PRD §31.7-31.8 — formalised, transparent)
CREATE TABLE sardar_profiles (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id       uuid NOT NULL UNIQUE REFERENCES users(id),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  cl_act_license_doc_id uuid REFERENCES kyc_documents(id),     -- Contract Labour Act licence
  supervision_fee_bps integer NOT NULL DEFAULT 1000 CHECK (supervision_fee_bps <= 1500),  -- DECLARED fee, ≤15% (skim >5% deviation flagged)
  grade          char(1) CHECK (grade IN ('A','B','C','D')),   -- annual review; only A/B keep access
  compliance_note text
);
CALL add_std_columns('sardar_profiles');

CREATE TABLE crews (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  sardar_id   uuid REFERENCES sardar_profiles(id),    -- NULL = platform-aggregated crew
  default_name varchar(150) NOT NULL,
  speciality_skill_id uuid REFERENCES skills(id),
  home_region_id uuid REFERENCES admin_regions(id),
  is_active   boolean NOT NULL DEFAULT true
);
CALL add_std_columns('crews');

CREATE TABLE crew_members (
  crew_id   uuid NOT NULL REFERENCES crews(id),
  worker_id uuid NOT NULL REFERENCES worker_profiles(id),
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at   timestamptz,
  PRIMARY KEY (crew_id, worker_id)
);

-- ---------- bookings: header supports 1 worker OR a crew of 100 (PRD demand types)
CREATE TABLE labour_bookings (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  booking_no      varchar(40) NOT NULL,
  employer_user_id uuid NOT NULL REFERENCES users(id),        -- farmer/FPO/tenant
  demand_type_id  uuid NOT NULL REFERENCES lookup_values(id), -- 'labour_demand_type': daily_single|daily_multi|skilled|crew|contract_task|seasonal|live_in|gang|sos
  task_skill_id   uuid NOT NULL REFERENCES skills(id),
  crew_id         uuid REFERENCES crews(id),
  workers_needed  smallint NOT NULL DEFAULT 1 CHECK (workers_needed BETWEEN 1 AND 500),
  start_date      date NOT NULL,
  end_date        date NOT NULL,
  daily_hours     numeric(4,2) NOT NULL DEFAULT 8,
  wage_kind       varchar(15) NOT NULL DEFAULT 'per_day' CHECK (wage_kind IN ('per_day','per_hour','per_task')),
  wage_offered_minor bigint NOT NULL,
  min_wage_minor  bigint NOT NULL,                    -- snapshot of statutory floor at posting
  currency_code   char(3) NOT NULL DEFAULT 'INR',
  overtime_rate_multiplier numeric(3,2) NOT NULL DEFAULT 1.5,
  women_only      boolean NOT NULL DEFAULT false,     -- PRD §31.11
  transport_provided boolean NOT NULL DEFAULT false,
  meals_provided  boolean NOT NULL DEFAULT false,
  stay_provided   boolean NOT NULL DEFAULT false,
  toilet_confirmed boolean NOT NULL DEFAULT false,    -- mandatory declaration for crews
  farm_address_id uuid REFERENCES addresses(id),
  farm_lat        numeric(9,6) NOT NULL,
  farm_lng        numeric(9,6) NOT NULL,
  status          booking_status NOT NULL DEFAULT 'open',
  respond_by      timestamptz,
  is_migrant_engagement boolean NOT NULL DEFAULT false,
  cancel_reason_id uuid REFERENCES lookup_values(id),
  version         integer NOT NULL DEFAULT 1,
  CONSTRAINT chk_dignity_floor CHECK (wage_offered_minor >= min_wage_minor),   -- THE RULE, in physics
  CONSTRAINT chk_dates CHECK (end_date >= start_date)
);
CALL add_std_columns('labour_bookings');
CREATE INDEX idx_lbook_tenant ON labour_bookings(tenant_id, status, start_date);
CREATE INDEX idx_lbook_employer ON labour_bookings(employer_user_id, created_at DESC);
CREATE INDEX idx_lbook_open ON labour_bookings(task_skill_id, start_date) WHERE status='open';

CREATE TABLE booking_assignments (                    -- one row per worker per booking
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  booking_id   uuid NOT NULL REFERENCES labour_bookings(id),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  worker_id    uuid NOT NULL REFERENCES worker_profiles(id),
  status       booking_status NOT NULL DEFAULT 'pending_worker',
  accepted_at  timestamptz,
  voice_consent_media_id uuid REFERENCES media_assets(id),    -- "yes I will come" recording (PRD §31.5)
  wage_minor   bigint NOT NULL,                       -- per-worker wage (≥ floor via booking)
  UNIQUE (booking_id, worker_id)
);
CALL add_std_columns('booking_assignments');
CREATE INDEX idx_bassign_worker ON booking_assignments(worker_id, created_at DESC);
-- one engagement per worker per day enforced via attendance + app check
-- (exclusion constraint with daterange optional Phase 2 hardening):
-- ALTER TABLE booking_assignments ADD CONSTRAINT excl_worker_day EXCLUDE USING gist (...)

CREATE TABLE attendance_records (                     -- geo-fenced, dual-confirmed (PRD §31.12)
  id            uuid NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id     uuid NOT NULL,
  assignment_id uuid NOT NULL,
  work_date     date NOT NULL,
  clock_in_at   timestamptz,
  clock_in_lat  numeric(9,6),
  clock_in_lng  numeric(9,6),
  clock_in_distance_m integer,                        -- ≤100m fence proof
  clock_in_method varchar(20) NOT NULL DEFAULT 'self', -- self|supervisor_biometric|paper_backfill
  clock_out_at  timestamptz,
  break_minutes integer NOT NULL DEFAULT 0,
  hours_regular numeric(4,2),
  hours_overtime numeric(4,2) NOT NULL DEFAULT 0,
  confirmed_by_employer boolean NOT NULL DEFAULT false,
  wage_payout_id uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at),
  UNIQUE (assignment_id, work_date, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX idx_attendance_assignment ON attendance_records(assignment_id, work_date);

-- ---------- advances / baki (PRD §31.15: capped, interest-free, anti-debt-trap)
CREATE TABLE worker_advances (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  worker_id    uuid NOT NULL REFERENCES worker_profiles(id),
  booking_id   uuid REFERENCES labour_bookings(id),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  status       advance_status NOT NULL DEFAULT 'requested',
  disbursal_payout_id uuid REFERENCES payouts(id),
  recovered_minor bigint NOT NULL DEFAULT 0
  -- caps (≤30% of booking, ≤3× daily wage outstanding) enforced in app + nightly audit query
);
CALL add_std_columns('worker_advances');
CREATE INDEX idx_advances_worker ON worker_advances(worker_id) WHERE status IN ('disbursed','partially_recovered');

-- ---------- insurance enrolments (PMSBY/PMJJBY/daily micro — PRD §31.16)
CREATE TABLE worker_insurance_enrolments (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  worker_id    uuid NOT NULL REFERENCES worker_profiles(id),
  product_id   uuid NOT NULL,                         -- FK → insurance_products (file 10) added there
  policy_ref   varchar(100),
  premium_minor bigint NOT NULL,
  premium_paid_by varchar(15) NOT NULL DEFAULT 'platform',   -- platform|worker|employer
  valid_from   date NOT NULL,
  valid_until  date NOT NULL,
  status       varchar(20) NOT NULL DEFAULT 'active'
);
CALL add_std_columns('worker_insurance_enrolments');
CREATE INDEX idx_wins_worker ON worker_insurance_enrolments(worker_id);

-- ---------- migrant engagements (PRD §31.9 protective layer)
CREATE TABLE migrant_engagements (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  booking_id    uuid NOT NULL REFERENCES labour_bookings(id),
  worker_id     uuid NOT NULL REFERENCES worker_profiles(id),
  origin_region_id uuid REFERENCES admin_regions(id),
  destination_region_id uuid REFERENCES admin_regions(id),
  travel_reimbursed_minor bigint NOT NULL DEFAULT 0,
  accommodation_media_id uuid REFERENCES media_assets(id),    -- shelter photo evidence
  onorc_checked boolean NOT NULL DEFAULT false,       -- One Nation One Ration Card
  departed_home_at timestamptz,
  returned_home_at timestamptz,
  return_confirmed boolean NOT NULL DEFAULT false
);
CALL add_std_columns('migrant_engagements');

-- ---------- MGNREGA convergence (PRD §31.10)
CREATE TABLE mgnrega_job_cards (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id      uuid NOT NULL REFERENCES users(id),
  job_card_no  varchar(30) NOT NULL UNIQUE,
  region_id    uuid REFERENCES admin_regions(id),
  days_used_fy smallint NOT NULL DEFAULT 0,           -- of 100-day guarantee
  last_synced_at timestamptz
);
CALL add_std_columns('mgnrega_job_cards');

-- ---------- safety & grievances (PRD §31.17/§31.19; harassment = women-officer lane)
CREATE TABLE safety_checklists (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  booking_id   uuid NOT NULL REFERENCES labour_bookings(id),
  checklist_type varchar(30) NOT NULL,                -- 'pesticide_ppe','heat','machinery','livestock'
  items        jsonb NOT NULL,                        -- [{item:'mask', confirmed:true, media_id:...}]
  confirmed_by uuid REFERENCES users(id)
);
CALL add_std_columns('safety_checklists');

CREATE TABLE labour_grievances (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  raised_by    uuid NOT NULL REFERENCES users(id),
  booking_id   uuid REFERENCES labour_bookings(id),
  grievance_type_id uuid NOT NULL REFERENCES lookup_values(id), -- 'labour_grievance': wage_short|hours|harassment|safety|sardar_skim|bonded_flag|no_show_claim
  is_confidential boolean NOT NULL DEFAULT false,     -- harassment lane
  description  text,
  status       varchar(20) NOT NULL DEFAULT 'open',   -- open|mediation|arbitration|external|resolved|dismissed
  sla_due_at   timestamptz,
  resolution   text,
  resolved_by  uuid REFERENCES users(id),
  resolved_at  timestamptz
);
CALL add_std_columns('labour_grievances');
CREATE INDEX idx_lgriev_open ON labour_grievances(tenant_id, status) WHERE status NOT IN ('resolved','dismissed');

