-- ============================================================================
-- MIGRATION 0010 — AGRI INFRA SERVICES
-- Source of truth: Database_Architecture/full_platform/09_agri_infra_services.sql (reproduced verbatim)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it
-- in schema_migrations. NEVER edit an applied migration — add a new numbered one.
-- ============================================================================

-- ============================================================================
-- FILE 09 — EQUIPMENT/CHC (M20) · DRONES (M25) · WAREHOUSING/NWR (M21)
--           CONTRACT FARMING (M22) · EXPORT/GI (M23) · LAND/SOIL/WEATHER (M24)
-- ============================================================================

CREATE TYPE rental_status AS ENUM ('requested','quoted','confirmed','in_progress','completed','settled','cancelled','disputed');
CREATE TYPE nwr_status AS ENUM ('issued','pledged','partially_released','released','cancelled','defaulted');
CREATE TYPE contract_status AS ENUM ('draft','proposed','negotiating','signed','active','fulfilled','breached','terminated','disputed');

-- ================= EQUIPMENT & CHC (M20, PRD §23) =================
CREATE TABLE equipment_assets (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  owner_user_id uuid NOT NULL REFERENCES users(id),   -- equipment_owner / CHC operator role
  category_id   uuid NOT NULL REFERENCES categories(id),     -- equipment tree: tractor|harvester|rotavator|drone|...
  product_id    uuid REFERENCES products(id),         -- make/model master (Mahindra 575…)
  reg_no        varchar(20),
  year_of_mfg   smallint,
  engine_hours  numeric(10,1),
  hp_rating     smallint,
  rc_doc_id     uuid REFERENCES kyc_documents(id),
  insurance_policy_id uuid,
  base_address_id uuid REFERENCES addresses(id),
  service_radius_km integer NOT NULL DEFAULT 25,
  gps_device_ref varchar(100),
  status        varchar(20) NOT NULL DEFAULT 'active' -- active|maintenance|retired
);
CALL add_std_columns('equipment_assets');
CREATE INDEX idx_equipment_owner ON equipment_assets(owner_user_id);
CREATE INDEX idx_equipment_cat ON equipment_assets(tenant_id, category_id) WHERE status='active';

CREATE TABLE equipment_rates (                        -- dynamic rate cards per asset
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  asset_id    uuid NOT NULL REFERENCES equipment_assets(id),
  rate_basis  varchar(15) NOT NULL CHECK (rate_basis IN ('per_hour','per_acre','per_day','per_job','per_km')),
  rate_minor  bigint NOT NULL,
  includes_operator boolean NOT NULL DEFAULT true,
  includes_fuel boolean NOT NULL DEFAULT false,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  UNIQUE (asset_id, rate_basis, effective_from)
);
CALL add_std_columns('equipment_rates');

CREATE TABLE equipment_bookings (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  booking_no    varchar(40) NOT NULL,
  renter_user_id uuid NOT NULL REFERENCES users(id),
  asset_id      uuid NOT NULL REFERENCES equipment_assets(id),
  operator_user_id uuid REFERENCES users(id),         -- from worker/operator pool
  task_desc     varchar(250),
  rate_basis    varchar(15) NOT NULL,
  rate_minor    bigint NOT NULL,
  est_quantity  numeric(10,2) NOT NULL,               -- hours / acres
  actual_quantity numeric(10,2),
  area_gps_trace jsonb,                               -- perimeter mapping evidence (±2% billing)
  scheduled_at  timestamptz NOT NULL,
  status        rental_status NOT NULL DEFAULT 'requested',
  advance_minor bigint NOT NULL DEFAULT 0,            -- escrow hold txn via ledger
  total_minor   bigint,
  payment_id    uuid REFERENCES payments(id),
  start_otp_hash varchar(128),
  started_at    timestamptz,
  completed_at  timestamptz
);
CALL add_std_columns('equipment_bookings');
CREATE INDEX idx_eqbook_asset ON equipment_bookings(asset_id, scheduled_at);
CREATE INDEX idx_eqbook_renter ON equipment_bookings(renter_user_id, created_at DESC);

CREATE TABLE equipment_maintenance_logs (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  asset_id   uuid NOT NULL REFERENCES equipment_assets(id),
  tenant_id  uuid NOT NULL,
  log_type   varchar(30) NOT NULL,                    -- service|repair|breakdown|inspection
  cost_minor bigint,
  notes      text,
  engine_hours_at numeric(10,1),
  performed_on date NOT NULL
);
CALL add_std_columns('equipment_maintenance_logs');

-- ---------- drones (M25, PRD §28): DGCA compliance + flight records
CREATE TABLE drone_registrations (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  asset_id        uuid NOT NULL UNIQUE REFERENCES equipment_assets(id),
  uin             varchar(40) UNIQUE NOT NULL,        -- DGCA DigitalSky UIN
  type_certificate varchar(80),
  insurance_valid_until date,
  payload_capacity_kg numeric(6,2)
);
CALL add_std_columns('drone_registrations');

CREATE TABLE drone_pilots (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id      uuid NOT NULL UNIQUE REFERENCES users(id),
  rpl_no       varchar(40) UNIQUE NOT NULL,           -- Remote Pilot License
  rpl_valid_until date NOT NULL,
  is_namo_drone_didi boolean NOT NULL DEFAULT false
);
CALL add_std_columns('drone_pilots');

CREATE TABLE drone_flights (                          -- spray/survey record (90-day legal retention min)
  id             uuid NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id      uuid NOT NULL,
  booking_id     uuid,                                -- equipment_bookings
  drone_reg_id   uuid NOT NULL,
  pilot_id       uuid NOT NULL,
  flight_kind    varchar(20) NOT NULL,                -- spray|survey|mapping|seeding
  chemical_product_id uuid,
  dose_per_acre  varchar(60),
  acres_covered  numeric(8,2),
  weather_check  jsonb,                               -- wind/rain pre-flight gate
  no_fly_check_passed boolean NOT NULL DEFAULT false,
  telemetry_media_id uuid,
  flown_at       timestamptz NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX idx_drone_flights ON drone_flights(drone_reg_id, flown_at DESC);

-- ================= WAREHOUSING & NWR (M21, PRD §24) =================
CREATE TABLE warehouses (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id     uuid REFERENCES tenants(id),          -- NULL = independent WDRA warehouse on marketplace
  operator_user_id uuid REFERENCES users(id),
  default_name  varchar(200) NOT NULL,
  wdra_reg_no   varchar(60),
  address_id    uuid REFERENCES addresses(id),
  capacity_mt   numeric(12,2),
  storage_kinds jsonb NOT NULL DEFAULT '[]',          -- ['ambient','cold_0_4','frozen','ca']
  commodities_accepted jsonb NOT NULL DEFAULT '[]',   -- category ids
  rate_per_qtl_month_minor bigint,
  insurance_policy_ref varchar(120),
  is_active     boolean NOT NULL DEFAULT true
);
CALL add_std_columns('warehouses');

CREATE TABLE storage_bookings (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  warehouse_id  uuid NOT NULL REFERENCES warehouses(id),
  depositor_user_id uuid NOT NULL REFERENCES users(id),
  product_id    uuid NOT NULL REFERENCES products(id),
  quantity      numeric(12,3) NOT NULL,
  unit_code     varchar(20) NOT NULL REFERENCES units(code),
  expected_arrival date,
  status        varchar(20) NOT NULL DEFAULT 'requested', -- requested|confirmed|stored|partially_released|released|cancelled
  stored_at     timestamptz,
  released_at   timestamptz
);
CALL add_std_columns('storage_bookings');

CREATE TABLE assay_reports (                          -- accredited quality assays (drives NWR valuation)
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  storage_booking_id uuid NOT NULL REFERENCES storage_bookings(id),
  assayer_name varchar(200) NOT NULL,
  parameters   jsonb NOT NULL,                        -- {moisture:11.2, fm:0.8, broken:2.1,...}
  grade_option_id uuid REFERENCES attribute_options(id),
  report_media_id uuid REFERENCES media_assets(id),
  assayed_at   timestamptz NOT NULL,
  valid_until  date                                   -- re-assay after 90 days
);
CALL add_std_columns('assay_reports');

CREATE TABLE nwr_receipts (                           -- electronic Negotiable Warehouse Receipts
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  storage_booking_id uuid NOT NULL REFERENCES storage_bookings(id),
  repository    varchar(20) NOT NULL,                 -- NERL|CCRL
  enwr_no       varchar(60) UNIQUE NOT NULL,
  holder_user_id uuid NOT NULL REFERENCES users(id),
  quantity      numeric(12,3) NOT NULL,
  valuation_minor bigint NOT NULL,
  status        nwr_status NOT NULL DEFAULT 'issued',
  pledged_loan_id uuid,                               -- FK → loans (file 10)
  issued_at     timestamptz NOT NULL,
  expires_at    date
);
CALL add_std_columns('nwr_receipts');
CREATE INDEX idx_nwr_holder ON nwr_receipts(holder_user_id, status);

-- ================= CONTRACT FARMING (M22, PRD §25) =================
CREATE TABLE contract_templates (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id    uuid REFERENCES tenants(id),           -- NULL = platform-standard (Model Act 2018)
  default_name varchar(200) NOT NULL,
  category_id  uuid REFERENCES categories(id),
  body_template text NOT NULL,                        -- merge-field legal text (translations for vernacular)
  clauses      jsonb NOT NULL DEFAULT '[]',
  is_active    boolean NOT NULL DEFAULT true
);
CALL add_std_columns('contract_templates');

CREATE TABLE farming_contracts (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  contract_no   varchar(40) NOT NULL,
  template_id   uuid REFERENCES contract_templates(id),
  buyer_user_id uuid NOT NULL REFERENCES users(id),   -- corporate/processor
  contract_kind varchar(20) NOT NULL CHECK (contract_kind IN ('pre_sowing','forward','tripartite')),
  product_id    uuid NOT NULL REFERENCES products(id),
  total_quantity numeric(14,3) NOT NULL,
  unit_code     varchar(20) NOT NULL REFERENCES units(code),
  price_model   varchar(20) NOT NULL CHECK (price_model IN ('fixed','floor_ceiling','formula')),
  price_terms   jsonb NOT NULL,                       -- {fixed_minor} | {floor_minor, ceiling_minor} | formula
  quality_spec  jsonb NOT NULL DEFAULT '{}',          -- binding parameters + premium/discount slabs
  financier_partner_id uuid,                          -- tripartite bank (file 10 partner)
  season        varchar(40),
  status        contract_status NOT NULL DEFAULT 'draft',
  esign_envelope_ref varchar(200),
  signed_at     timestamptz
);
CALL add_std_columns('farming_contracts');

CREATE TABLE contract_growers (                       -- many farmers per contract (FPO aggregation)
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  contract_id  uuid NOT NULL REFERENCES farming_contracts(id),
  tenant_id    uuid NOT NULL,
  farmer_user_id uuid NOT NULL REFERENCES users(id),
  land_parcel_id uuid,                                -- FK → land_parcels below
  committed_quantity numeric(14,3) NOT NULL,
  UNIQUE (contract_id, farmer_user_id, land_parcel_id)
);
CALL add_std_columns('contract_growers');

CREATE TABLE contract_milestones (                    -- sowing/mid/harvest gates w/ geo-photo proof
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  contract_id  uuid NOT NULL REFERENCES farming_contracts(id),
  grower_id    uuid REFERENCES contract_growers(id),
  tenant_id    uuid NOT NULL,
  milestone_type varchar(30) NOT NULL,                -- sowing_confirm|midseason|preharvest_estimate|delivery|payment
  due_on       date,
  completed_at timestamptz,
  evidence_media_id uuid REFERENCES media_assets(id),
  data         jsonb NOT NULL DEFAULT '{}'
);
CALL add_std_columns('contract_milestones');

CREATE TABLE contract_input_advances (                -- buyer-supplied seed/inputs, recovered at settlement
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  contract_id  uuid NOT NULL REFERENCES farming_contracts(id),
  grower_id    uuid NOT NULL REFERENCES contract_growers(id),
  tenant_id    uuid NOT NULL,
  product_id   uuid REFERENCES products(id),
  description  varchar(250),
  value_minor  bigint NOT NULL,
  recovered_minor bigint NOT NULL DEFAULT 0
);
CALL add_std_columns('contract_input_advances');

-- ================= EXPORT & GI (M23, PRD §26) =================
CREATE TABLE exporter_registrations (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  exporter_user_id uuid REFERENCES users(id),
  authority    varchar(20) NOT NULL,                  -- APEDA|MPEDA|SPICES_BOARD|TEA|COFFEE
  reg_no       varchar(60) NOT NULL,                  -- RCMC
  iec_code     varchar(20),
  valid_until  date,
  doc_id       uuid REFERENCES kyc_documents(id)
);
CALL add_std_columns('exporter_registrations');

CREATE TABLE export_shipments (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  exporter_user_id uuid NOT NULL REFERENCES users(id),
  destination_country char(2) NOT NULL REFERENCES countries(code),
  incoterm      varchar(10),
  status        varchar(30) NOT NULL DEFAULT 'draft', -- draft|docs_in_progress|inspection|shipped|delivered|paid|closed
  order_ids     jsonb NOT NULL DEFAULT '[]',
  vessel_or_awb varchar(80),
  lc_ref        varchar(80),
  total_value_minor bigint,
  currency_code char(3) NOT NULL DEFAULT 'USD'
);
CALL add_std_columns('export_shipments');

CREATE TABLE export_documents (                       -- BoL, CI, PL, CoO, phyto — checklist driven
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  shipment_id  uuid NOT NULL REFERENCES export_shipments(id),
  tenant_id    uuid NOT NULL,
  doc_type_id  uuid NOT NULL REFERENCES lookup_values(id), -- 'export_doc': bol|awb|commercial_invoice|packing_list|coo|phyto|fumigation|insurance|inspection
  media_id     uuid REFERENCES media_assets(id),
  status       varchar(20) NOT NULL DEFAULT 'pending',
  reference_no varchar(80)
);
CALL add_std_columns('export_documents');

CREATE TABLE compliance_requirements (                -- country-specific MRL/cert rules as data (PRD §26.8)
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  destination_country char(2) NOT NULL REFERENCES countries(code),
  category_id   uuid REFERENCES categories(id),
  requirement_code varchar(60) NOT NULL,              -- 'eu_mrl','usda_nop','halal','jas_organic'
  rules         jsonb NOT NULL,
  effective_from date NOT NULL,
  effective_to  date
);
CALL add_std_columns('compliance_requirements');

-- ================= LAND, SOIL, WEATHER (M24, PRD §27) =================
CREATE TABLE land_parcels (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  owner_user_id uuid NOT NULL REFERENCES users(id),
  region_id     uuid REFERENCES admin_regions(id),
  survey_no     varchar(60),                          -- khasra/survey number
  bhulekh_ref   varchar(120),                         -- state land-record linkage
  area_value    numeric(10,4) NOT NULL,
  area_unit     varchar(20) NOT NULL DEFAULT 'acre' REFERENCES units(code),
  irrigation_type_id uuid REFERENCES lookup_values(id), -- 'irrigation': rainfed|canal|borewell|drip|sprinkler
  boundary_geojson jsonb,                             -- polygon (PostGIS upgrade path)
  verification_status kyc_status NOT NULL DEFAULT 'none',
  is_tenant_farmed boolean NOT NULL DEFAULT false     -- cultivator ≠ owner flag
);
CALL add_std_columns('land_parcels');
CREATE INDEX idx_parcels_owner ON land_parcels(owner_user_id);
ALTER TABLE contract_growers ADD CONSTRAINT fk_growers_parcel FOREIGN KEY (land_parcel_id) REFERENCES land_parcels(id);

CREATE TABLE crop_seasons (                           -- what's growing where (drives advisory + forecast)
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  parcel_id    uuid NOT NULL REFERENCES land_parcels(id),
  product_id   uuid NOT NULL REFERENCES products(id),
  season       varchar(20) NOT NULL,                  -- kharif|rabi|zaid|perennial
  year         smallint NOT NULL,
  sown_on      date,
  expected_harvest date,
  expected_yield numeric(12,3),
  actual_yield numeric(12,3),
  status       varchar(20) NOT NULL DEFAULT 'planned'
);
CALL add_std_columns('crop_seasons');
CREATE INDEX idx_cropseasons_parcel ON crop_seasons(parcel_id, year);

CREATE TABLE soil_tests (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  parcel_id    uuid NOT NULL REFERENCES land_parcels(id),
  lab_name     varchar(200),
  shc_card_no  varchar(60),                           -- govt Soil Health Card linkage
  sampled_on   date NOT NULL,
  results      jsonb NOT NULL,                        -- {ph, ec, oc, n, p, k, s, zn, fe, cu, mn, b}
  recommendations jsonb NOT NULL DEFAULT '{}',
  report_media_id uuid REFERENCES media_assets(id),
  valid_until  date
);
CALL add_std_columns('soil_tests');

CREATE TABLE weather_alerts (                         -- pushed advisories (IMD/Skymet ingestion)
  id          uuid NOT NULL DEFAULT uuid_generate_v7(),
  region_id   uuid NOT NULL,
  alert_type_id uuid NOT NULL,                        -- lookup 'weather_alert': heavy_rain|drought|frost|hail|heatwave|cyclone|pest_risk
  severity    varchar(15) NOT NULL,
  valid_from  timestamptz NOT NULL,
  valid_to    timestamptz NOT NULL,
  advisory_text_key varchar(200),                     -- translated via ui_messages/translations
  payload     jsonb NOT NULL DEFAULT '{}',
  source      varchar(60) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX idx_weather_alerts_region ON weather_alerts(region_id, valid_to);

