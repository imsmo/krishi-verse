-- ============================================================================
-- MIGRATION 0009 — LIVESTOCK DAIRY
-- Source of truth: Database_Architecture/full_platform/08_livestock_dairy.sql (reproduced verbatim)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it
-- in schema_migrations. NEVER edit an applied migration — add a new numbered one.
-- ============================================================================

-- ============================================================================
-- FILE 08 — PASHUPALAN (M15, PRD §18) + DAIRY ECOSYSTEM (M16, PRD §19)
-- Dynamic species/breed taxonomy, Pashu Aadhaar, vet marketplace, breeding,
-- MCC operations with daily-partitioned milk collections, rate cards, payouts,
-- cooperative governance, D2C dairy subscriptions.
-- ============================================================================

CREATE TYPE vet_booking_status AS ENUM ('requested','accepted','en_route','in_consult','prescribed','completed','cancelled','no_show');
CREATE TYPE milk_shift AS ENUM ('morning','evening');

-- ---------- dynamic species/breed taxonomy (cow, buffalo, goat, poultry, fish, bee…)
CREATE TABLE animal_species (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  code         varchar(40) UNIQUE NOT NULL,           -- 'cattle','buffalo','goat','sheep','poultry','fish','bee','pig','camel'
  default_name varchar(100) NOT NULL,
  is_active    boolean NOT NULL DEFAULT true
);
CALL add_std_columns('animal_species');

CREATE TABLE animal_breeds (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  species_id   uuid NOT NULL REFERENCES animal_species(id),
  code         varchar(60) NOT NULL,                  -- 'gir','sahiwal','murrah','jaffarabadi','sirohi','kadaknath'
  default_name varchar(100) NOT NULL,
  is_indigenous boolean NOT NULL DEFAULT false,       -- conservation programmes (PRD §18.13)
  origin_region_id uuid REFERENCES admin_regions(id),
  UNIQUE (species_id, code)
);
CALL add_std_columns('animal_breeds');

-- ---------- animals (the asset registry; Pashu Aadhaar / INAPH)
CREATE TABLE animals (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  owner_user_id   uuid NOT NULL REFERENCES users(id),
  species_id      uuid NOT NULL REFERENCES animal_species(id),
  breed_id        uuid REFERENCES animal_breeds(id),
  pashu_aadhaar   varchar(12) UNIQUE,                 -- INAPH 12-digit
  name            varchar(100),
  sex             varchar(10),
  dob_estimated   date,
  parity          smallint,                           -- calvings count
  lactation_stage varchar(20),                        -- dry|early|mid|late
  current_yield_lpd numeric(6,2),                     -- litres/day
  last_calving_date date,
  expected_calving_date date,
  pregnancy_status varchar(20),
  body_condition_score numeric(2,1),
  status          varchar(20) NOT NULL DEFAULT 'active',  -- active|sold|deceased|lost
  acquired_via    varchar(20),                        -- born|purchased|transferred
  insurance_policy_id uuid                            -- FK → insurance_policies (file 10)
);
CALL add_std_columns('animals');
CREATE INDEX idx_animals_owner ON animals(owner_user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_animals_tenant_species ON animals(tenant_id, species_id);

CREATE TABLE animal_attribute_values (                -- species-specific dynamic attrs (EAV, L8)
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  animal_id    uuid NOT NULL REFERENCES animals(id),
  attribute_id uuid NOT NULL REFERENCES attribute_definitions(id),
  value_text   text, value_number numeric(20,6), value_bool boolean, value_date date,
  option_id    uuid REFERENCES attribute_options(id),
  UNIQUE (animal_id, attribute_id)
);

CREATE TABLE animal_health_events (                   -- lifetime health file (PRD §18.12)
  id          uuid NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id   uuid NOT NULL,
  animal_id   uuid NOT NULL,
  event_type_id uuid NOT NULL,                        -- lookup 'animal_health_event': vaccination|deworming|treatment|ai_insemination|pd_check|calving|injury|death
  vet_booking_id uuid,
  vaccine_product_id uuid,
  batch_no    varchar(80),
  diagnosis   text,
  outcome     text,
  next_due_date date,                                 -- reminder calendar driver
  recorded_by uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX idx_ahe_animal ON animal_health_events(animal_id, created_at DESC);
CREATE INDEX idx_ahe_due ON animal_health_events(next_due_date) WHERE next_due_date IS NOT NULL;

CREATE TABLE animal_ownership_transfers (             -- sale → INAPH re-registration trail
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  animal_id     uuid NOT NULL REFERENCES animals(id),
  from_user_id  uuid NOT NULL REFERENCES users(id),
  to_user_id    uuid NOT NULL REFERENCES users(id),
  order_id      uuid,                                 -- marketplace sale order
  price_minor   bigint,
  inaph_synced  boolean NOT NULL DEFAULT false,
  transferred_at timestamptz NOT NULL DEFAULT now()
);
CALL add_std_columns('animal_ownership_transfers');

-- animal marketplace listings reuse listings (category 'livestock') with
-- listing_attribute_values; link table binds listing → specific animal:
CREATE TABLE listing_animals (
  listing_id uuid NOT NULL REFERENCES listings(id),
  animal_id  uuid NOT NULL REFERENCES animals(id),
  PRIMARY KEY (listing_id, animal_id)
);

-- ---------- vet marketplace (PRD §18.8)
CREATE TABLE vet_profiles (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id       uuid NOT NULL UNIQUE REFERENCES users(id),
  tenant_id     uuid REFERENCES tenants(id),
  registration_no varchar(60) NOT NULL,               -- VCI registration
  degree_doc_id uuid REFERENCES kyc_documents(id),
  is_ai_technician boolean NOT NULL DEFAULT false,
  service_radius_km integer NOT NULL DEFAULT 25,
  base_region_id uuid REFERENCES admin_regions(id),
  rating_avg    numeric(3,2)
);
CALL add_std_columns('vet_profiles');

CREATE TABLE vet_services (                           -- dynamic catalog: consult, vaccination, AI, PD, surgery…
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  vet_id       uuid NOT NULL REFERENCES vet_profiles(id),
  service_type_id uuid NOT NULL REFERENCES lookup_values(id), -- lookup 'vet_service'
  price_minor  bigint NOT NULL,
  pricing_unit varchar(20) NOT NULL DEFAULT 'per_visit',      -- per_visit|per_dose|per_animal|per_minute
  is_emergency_available boolean NOT NULL DEFAULT false,
  UNIQUE (vet_id, service_type_id)
);
CALL add_std_columns('vet_services');

CREATE TABLE vet_bookings (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  farmer_user_id uuid NOT NULL REFERENCES users(id),
  vet_id        uuid NOT NULL REFERENCES vet_profiles(id),
  service_id    uuid NOT NULL REFERENCES vet_services(id),
  animal_id     uuid REFERENCES animals(id),
  urgency       varchar(15) NOT NULL DEFAULT 'routine' CHECK (urgency IN ('emergency','urgent','routine')),
  mode          varchar(15) NOT NULL DEFAULT 'visit' CHECK (mode IN ('visit','tele')),
  symptoms_text text,
  symptoms_voice_media_id uuid REFERENCES media_assets(id),
  ai_triage     jsonb,                                -- urgency suggestion + differential hints
  scheduled_at  timestamptz,
  status        vet_booking_status NOT NULL DEFAULT 'requested',
  fee_minor     bigint,
  payment_id    uuid REFERENCES payments(id),
  completed_at  timestamptz
);
CALL add_std_columns('vet_bookings');
CREATE INDEX idx_vetbook_vet ON vet_bookings(vet_id, status);
CREATE INDEX idx_vetbook_farmer ON vet_bookings(farmer_user_id, created_at DESC);

CREATE TABLE prescriptions (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id),
  vet_booking_id uuid NOT NULL REFERENCES vet_bookings(id),
  vet_id         uuid NOT NULL REFERENCES vet_profiles(id),
  animal_id      uuid REFERENCES animals(id),
  digital_signature_ref varchar(200),
  valid_until    date
);
CALL add_std_columns('prescriptions');

CREATE TABLE prescription_items (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  prescription_id uuid NOT NULL REFERENCES prescriptions(id),
  product_id      uuid REFERENCES products(id),       -- orderable from pharma module
  drug_name       varchar(200) NOT NULL,
  dosage          varchar(200) NOT NULL,
  duration_days   smallint,
  is_schedule_h   boolean NOT NULL DEFAULT false      -- restricted drug audit trail
);

-- ---------- breeding & genetics (PRD §18.13)
CREATE TABLE semen_catalog (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  bull_code    varchar(60) UNIQUE NOT NULL,
  species_id   uuid NOT NULL REFERENCES animal_species(id),
  breed_id     uuid NOT NULL REFERENCES animal_breeds(id),
  station      varchar(200),                          -- 'Sabarmati Ashram Gaushala','NDDB'
  is_sexed     boolean NOT NULL DEFAULT false,
  expected_yield_uplift varchar(100),
  progeny_data jsonb NOT NULL DEFAULT '{}',
  price_minor  bigint NOT NULL,
  is_active    boolean NOT NULL DEFAULT true
);
CALL add_std_columns('semen_catalog');

CREATE TABLE insemination_records (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  animal_id     uuid NOT NULL REFERENCES animals(id),
  semen_id      uuid REFERENCES semen_catalog(id),
  technician_vet_id uuid REFERENCES vet_profiles(id),
  vet_booking_id uuid REFERENCES vet_bookings(id),
  heat_reported_at timestamptz,
  performed_at  timestamptz NOT NULL,
  pd_due_date   date,                                 -- 90-day pregnancy check auto-booking
  pd_result     varchar(15),                          -- pending|pregnant|empty
  outcome_calving_event_id uuid
);
CALL add_std_columns('insemination_records');
CREATE INDEX idx_insem_animal ON insemination_records(animal_id);

CREATE TABLE disease_outbreaks (                      -- geo-fenced alerts (PRD §18.12 / risk R13)
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  disease_id   uuid NOT NULL REFERENCES lookup_values(id), -- lookup 'animal_disease': fmd|hs|bq|brucellosis|bird_flu|lsd
  species_id   uuid REFERENCES animal_species(id),
  region_id    uuid NOT NULL REFERENCES admin_regions(id),
  severity     varchar(15) NOT NULL DEFAULT 'watch',  -- watch|alert|emergency
  movement_restricted boolean NOT NULL DEFAULT false, -- blocks animal sale/transport in region
  declared_at  timestamptz NOT NULL DEFAULT now(),
  cleared_at   timestamptz,
  source       varchar(200)
);
CALL add_std_columns('disease_outbreaks');
CREATE INDEX idx_outbreaks_active ON disease_outbreaks(region_id) WHERE cleared_at IS NULL;

-- ============================================================================
-- DAIRY (M16) — daily-cycle operations
-- ============================================================================
CREATE TABLE mcc_centres (                            -- Milk Collection Centres
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  code         varchar(40) NOT NULL,
  default_name varchar(150) NOT NULL,
  region_id    uuid REFERENCES admin_regions(id),
  lat          numeric(9,6),
  lng          numeric(9,6),
  operator_user_id uuid REFERENCES users(id),
  capacity_litres_shift numeric(10,2),
  analyzer_model varchar(100),                        -- Lactoscan integration
  analyzer_serial varchar(100),
  is_active    boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, code)
);
CALL add_std_columns('mcc_centres');

CREATE TABLE bmc_units (                              -- Bulk Milk Coolers at MCC
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  mcc_id       uuid NOT NULL REFERENCES mcc_centres(id),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  capacity_litres numeric(10,2) NOT NULL,
  target_temp_c numeric(4,1) NOT NULL DEFAULT 4.0,
  iot_device_ref varchar(100)                         -- temperature logs → cold_chain_logs
);
CALL add_std_columns('bmc_units');

CREATE TABLE dairy_memberships (                      -- farmer ↔ MCC route + payment cycle prefs
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  farmer_user_id uuid NOT NULL REFERENCES users(id),
  mcc_id        uuid NOT NULL REFERENCES mcc_centres(id),
  member_code   varchar(40) NOT NULL,                 -- card/QR at the counter
  payment_cycle varchar(15) NOT NULL DEFAULT 'weekly' CHECK (payment_cycle IN ('daily','weekly','fortnightly','monthly')),
  default_animal_type varchar(10) CHECK (default_animal_type IN ('cow','buffalo','mixed')),
  is_active     boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, mcc_id, member_code)
);
CALL add_std_columns('dairy_memberships');

CREATE TABLE milk_rate_cards (                        -- dynamic pricing (PRD §19.4): versioned, per tenant
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  default_name varchar(120) NOT NULL,
  animal_type  varchar(10) NOT NULL CHECK (animal_type IN ('cow','buffalo','mixed')),
  pricing_model varchar(20) NOT NULL CHECK (pricing_model IN ('two_axis','fat_pooled','snf_pooled')),
  rate_per_kg_fat_minor bigint,
  rate_per_kg_snf_minor bigint,
  base_rate_per_litre_minor bigint,
  bonus_rules  jsonb NOT NULL DEFAULT '[]',           -- premium/penalty slabs
  effective_from date NOT NULL,
  effective_to date,
  is_active    boolean NOT NULL DEFAULT true
);
CALL add_std_columns('milk_rate_cards');

CREATE TABLE milk_collections (                       -- PARTITIONED DAILY-SCALE: 2 rows/farmer/day × millions
  id            uuid NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id     uuid NOT NULL,
  mcc_id        uuid NOT NULL,
  membership_id uuid NOT NULL,
  shift         milk_shift NOT NULL,
  collected_on  date NOT NULL,
  weight_kg     numeric(8,3) NOT NULL,
  fat_pct       numeric(4,2) NOT NULL,
  snf_pct       numeric(4,2) NOT NULL,
  density       numeric(6,3),
  water_flag    boolean NOT NULL DEFAULT false,
  adulteration_flags jsonb NOT NULL DEFAULT '[]',     -- urea|starch|detergent test hits
  rate_card_id  uuid NOT NULL,
  amount_minor  bigint NOT NULL,                      -- computed at the counter, slip printed
  device_payload jsonb,                               -- raw analyzer reading (evidence)
  entered_by    uuid,
  milk_bill_id  uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, collected_on),
  UNIQUE (membership_id, collected_on, shift)
) PARTITION BY RANGE (collected_on);
CREATE INDEX idx_milkcoll_member ON milk_collections(membership_id, collected_on DESC);
CREATE INDEX idx_milkcoll_mcc ON milk_collections(mcc_id, collected_on, shift);

CREATE TABLE milk_bills (                             -- aggregated per cycle → payout (PRD §19.5)
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  membership_id uuid NOT NULL REFERENCES dairy_memberships(id),
  period_start  date NOT NULL,
  period_end    date NOT NULL,
  total_litres  numeric(10,2) NOT NULL,
  gross_minor   bigint NOT NULL,
  deductions    jsonb NOT NULL DEFAULT '[]',          -- [{type:'feed_credit'|'loan_emi'|'insurance'|'share', amount_minor}]
  deductions_minor bigint NOT NULL DEFAULT 0,
  net_minor     bigint NOT NULL,
  status        varchar(20) NOT NULL DEFAULT 'draft', -- draft|previewed|disputed|approved|paid
  dispute_window_ends timestamptz,
  payout_id     uuid REFERENCES payouts(id),
  UNIQUE (membership_id, period_start, period_end)
);
CALL add_std_columns('milk_bills');
CREATE INDEX idx_milkbills_due ON milk_bills(tenant_id, status) WHERE status IN ('approved','previewed');

-- ---------- cooperative governance (PRD §19.6)
CREATE TABLE coop_share_registers (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  member_user_id uuid NOT NULL REFERENCES users(id),
  shares_held   integer NOT NULL DEFAULT 0,
  share_value_minor bigint NOT NULL,
  voting_eligible boolean NOT NULL DEFAULT false,
  UNIQUE (tenant_id, member_user_id)
);
CALL add_std_columns('coop_share_registers');

CREATE TABLE coop_resolutions (                       -- AGM votes, dividends, patronage bonus
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  title        varchar(250) NOT NULL,
  body         text,
  resolution_type varchar(30) NOT NULL,               -- agm_vote|dividend|patronage_bonus|board_election
  voting_opens timestamptz,
  voting_closes timestamptz,
  payload      jsonb NOT NULL DEFAULT '{}',           -- dividend %, bonus formula
  status       varchar(20) NOT NULL DEFAULT 'draft'
);
CALL add_std_columns('coop_resolutions');

CREATE TABLE coop_votes (
  resolution_id uuid NOT NULL REFERENCES coop_resolutions(id),
  member_user_id uuid NOT NULL REFERENCES users(id),
  choice       varchar(20) NOT NULL,
  cast_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (resolution_id, member_user_id)
);

-- ---------- D2C dairy subscriptions (PRD §19.13; generic enough for veggie boxes too)
CREATE TABLE subscription_plans_d2c (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  seller_user_id uuid REFERENCES users(id),
  product_id   uuid NOT NULL REFERENCES products(id),
  default_name varchar(150) NOT NULL,
  frequency    varchar(20) NOT NULL CHECK (frequency IN ('daily','alternate_day','weekly','monthly')),
  qty_per_delivery numeric(8,3) NOT NULL,
  unit_code    varchar(20) NOT NULL REFERENCES units(code),
  price_per_delivery_minor bigint NOT NULL,
  delivery_window varchar(40),                        -- '05:00-07:00'
  is_active    boolean NOT NULL DEFAULT true
);
CALL add_std_columns('subscription_plans_d2c');

CREATE TABLE d2c_subscriptions (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  plan_id      uuid NOT NULL REFERENCES subscription_plans_d2c(id),
  customer_user_id uuid NOT NULL REFERENCES users(id),
  address_id   uuid NOT NULL REFERENCES addresses(id),
  status       varchar(20) NOT NULL DEFAULT 'active', -- active|paused|cancelled
  starts_on    date NOT NULL,
  paused_until date,
  billing_mode varchar(20) NOT NULL DEFAULT 'monthly_postpaid'
);
CALL add_std_columns('d2c_subscriptions');

CREATE TABLE d2c_deliveries (                         -- one row per drop (partitioned: daily × thousands)
  id              uuid NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id       uuid NOT NULL,
  subscription_id uuid NOT NULL,
  due_on          date NOT NULL,
  status          varchar(20) NOT NULL DEFAULT 'scheduled', -- scheduled|delivered|skipped|failed|refunded
  delivered_at    timestamptz,
  qty             numeric(8,3),
  quality_meta    jsonb,                              -- {fat, snf, temp_c} farm-to-fork transparency
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, due_on)
) PARTITION BY RANGE (due_on);
CREATE INDEX idx_d2c_deliv_sub ON d2c_deliveries(subscription_id, due_on DESC);

