-- ============================================================================
-- MIGRATION 0015 — AUDIT ADDITIONS
-- Source of truth: Database_Architecture/full_platform/14_audit_additions.sql (reproduced verbatim)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it
-- in schema_migrations. NEVER edit an applied migration — add a new numbered one.
-- ============================================================================

-- ============================================================================
-- FILE 14 — AUDIT ADDITIONS (gaps found in the deep review, June 2026)
-- 16 table groups the v2 build missed. Run after 00-12, before 13.
-- (File 13's RLS + partition automation will cover these automatically.)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 14.1 BUYER/CONSUMER MEMBERSHIPS — a whole REVENUE STREAM that was missing.
-- Revenue Playbook: Household Plus ₹199 / Premium ₹499 / Business ₹999 /
-- Wholesale ₹2,999 with sliding platform-fee %. Tiers are dynamic data.
-- ----------------------------------------------------------------------------
CREATE TABLE membership_tiers (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id       uuid REFERENCES tenants(id),        -- NULL = platform-standard tiers
  code            varchar(40) NOT NULL,               -- 'household_free','household_plus','business','wholesale'
  default_name    varchar(120) NOT NULL,
  audience_role_id uuid REFERENCES roles(id),         -- customer | vyapari
  monthly_fee_minor bigint NOT NULL DEFAULT 0,
  annual_fee_minor bigint,
  currency_code   char(3) NOT NULL DEFAULT 'INR',
  platform_fee_bps_override integer,                  -- 250→100 bps sliding fee
  benefits        jsonb NOT NULL DEFAULT '{}',        -- {free_delivery:true, credit_days:30, credit_limit_minor:...}
  is_active       boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, code)
);
CALL add_std_columns('membership_tiers');

CREATE TABLE user_memberships (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  user_id       uuid NOT NULL REFERENCES users(id),
  tier_id       uuid NOT NULL REFERENCES membership_tiers(id),
  status        varchar(20) NOT NULL DEFAULT 'active',      -- active|past_due|cancelled|expired
  billing_cycle varchar(10) NOT NULL DEFAULT 'monthly',
  current_period_end date,
  payment_id    uuid REFERENCES payments(id)
);
CALL add_std_columns('user_memberships');
CREATE UNIQUE INDEX uq_user_membership_active ON user_memberships(tenant_id, user_id)
  WHERE status='active' AND deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 14.2 LISTING OFFERS / NEGOTIATION — your design system has screen 99
-- "buyer-make-offer"; the schema had no table for it.
-- ----------------------------------------------------------------------------
CREATE TABLE listing_offers (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  listing_id      uuid NOT NULL REFERENCES listings(id),
  buyer_user_id   uuid NOT NULL REFERENCES users(id),
  quantity        numeric(14,3) NOT NULL,
  offered_price_minor bigint NOT NULL,
  counter_price_minor bigint,                          -- seller counter
  round           smallint NOT NULL DEFAULT 1,
  status          varchar(20) NOT NULL DEFAULT 'open', -- open|countered|accepted|rejected|expired|converted
  expires_at      timestamptz NOT NULL,
  converted_order_id uuid,
  ai_suggested    jsonb                                -- AI negotiation assistant hints (Phase 3)
);
CALL add_std_columns('listing_offers');
CREATE INDEX idx_offers_listing ON listing_offers(listing_id) WHERE status IN ('open','countered');
CREATE INDEX idx_offers_buyer ON listing_offers(buyer_user_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 14.3 SAVED ITEMS & SAVED SEARCHES — screens 126/128 in your design system.
-- ----------------------------------------------------------------------------
CREATE TABLE saved_items (                             -- polymorphic favourites/watchlist
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  user_id     uuid NOT NULL REFERENCES users(id),
  entity_type varchar(40) NOT NULL,                    -- 'listing','product','seller','worker','course'
  entity_id   uuid NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entity_type, entity_id)
);
CREATE INDEX idx_saved_items_user ON saved_items(user_id, created_at DESC);

CREATE TABLE saved_searches (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  user_id      uuid NOT NULL REFERENCES users(id),
  default_name varchar(150) NOT NULL,
  query        jsonb NOT NULL,                         -- {text, category_id, filters{}, sort}
  notify_new_matches boolean NOT NULL DEFAULT false,
  last_notified_at timestamptz
);
CALL add_std_columns('saved_searches');
CREATE INDEX idx_saved_searches_notify ON saved_searches(user_id) WHERE notify_new_matches;

-- ----------------------------------------------------------------------------
-- 14.4 GENERIC SERVICE MARKETPLACE — closes M27/M30 (agritourism/farm stays,
-- soil-lab bookings, custom services, bee consultants, AR farm tours later).
-- Vet/equipment/storage keep their specialised tables; everything else
-- service-shaped books through here.
-- ----------------------------------------------------------------------------
CREATE TABLE service_offerings (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  provider_user_id uuid NOT NULL REFERENCES users(id),
  category_id      uuid NOT NULL REFERENCES categories(id),   -- service branch of the SAME category tree
  default_title    varchar(250) NOT NULL,
  description      text,
  pricing_model    varchar(20) NOT NULL CHECK (pricing_model IN ('per_hour','per_day','per_unit','per_person','per_visit','fixed')),
  price_minor      bigint NOT NULL,
  currency_code    char(3) NOT NULL DEFAULT 'INR',
  capacity_per_slot smallint,
  service_radius_km integer,
  address_id       uuid REFERENCES addresses(id),
  status           varchar(20) NOT NULL DEFAULT 'draft'       -- draft|published|paused|archived
);
CALL add_std_columns('service_offerings');
CREATE INDEX idx_services_browse ON service_offerings(tenant_id, category_id) WHERE status='published';

CREATE TABLE service_bookings (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  offering_id   uuid NOT NULL REFERENCES service_offerings(id),
  customer_user_id uuid NOT NULL REFERENCES users(id),
  booking_no    varchar(40) NOT NULL,
  starts_at     timestamptz NOT NULL,
  ends_at       timestamptz,
  guests        smallint NOT NULL DEFAULT 1,
  total_minor   bigint NOT NULL,
  status        varchar(20) NOT NULL DEFAULT 'requested',     -- requested|confirmed|in_progress|completed|cancelled|disputed
  payment_id    uuid REFERENCES payments(id),
  notes         text
);
CALL add_std_columns('service_bookings');
CREATE INDEX idx_svcbook_provider ON service_bookings(offering_id, starts_at);

-- ----------------------------------------------------------------------------
-- 14.5 SEARCH SYNONYMS / VERNACULAR ALIASES — your Survival Guide names this
-- exact problem: "tur" vs "arhar", quintal vs kg, regional crop names.
-- Feeds the OpenSearch synonym pipeline; admin-curated, language-aware.
-- ----------------------------------------------------------------------------
CREATE TABLE search_synonyms (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  term          varchar(150) NOT NULL,                 -- 'tur','tuvar','અડદ'
  language_code varchar(8) REFERENCES languages(code),
  entity_type   varchar(40) NOT NULL DEFAULT 'product',
  entity_id     uuid NOT NULL,                         -- canonical product/category
  weight        smallint NOT NULL DEFAULT 100,
  is_active     boolean NOT NULL DEFAULT true,
  UNIQUE (term, language_code, entity_type, entity_id)
);
CALL add_std_columns('search_synonyms');
CREATE INDEX idx_synonyms_term ON search_synonyms USING gin (term gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- 14.6 EXTERNAL ENTITY REFERENCES — one mapping table for every government /
-- partner system id (INAPH animal ids, e-NAM listings, PFMS beneficiary ids,
-- ONDC transaction ids, Agmarknet commodity codes...). Without this, every
-- integration grows its own ref columns forever.
-- ----------------------------------------------------------------------------
CREATE TABLE external_entity_refs (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  provider_code varchar(60) NOT NULL REFERENCES integration_providers(code),
  entity_type   varchar(60) NOT NULL,                  -- 'animal','listing','user','scheme_application','product'
  entity_id     uuid NOT NULL,
  external_id   varchar(200) NOT NULL,
  sync_status   varchar(20) NOT NULL DEFAULT 'synced', -- synced|pending|failed|conflict
  last_synced_at timestamptz,
  payload       jsonb NOT NULL DEFAULT '{}',
  UNIQUE (provider_code, entity_type, entity_id),
  UNIQUE (provider_code, entity_type, external_id)
);
CALL add_std_columns('external_entity_refs');
CREATE INDEX idx_extrefs_entity ON external_entity_refs(entity_type, entity_id);

-- ----------------------------------------------------------------------------
-- 14.7 INBOUND WEBHOOK LOG — raw provider callbacks (Razorpay, Gupshup, WA…)
-- stored before processing: replayable, debuggable, audit-grade. Partitioned.
-- ----------------------------------------------------------------------------
CREATE TABLE inbound_webhooks (
  id            bigserial,
  provider_code varchar(60) NOT NULL,
  event_type    varchar(120),
  signature_ok  boolean,
  payload       jsonb NOT NULL,
  processing_status varchar(20) NOT NULL DEFAULT 'received',  -- received|processed|ignored|failed
  processed_at  timestamptz,
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX idx_inwh_pending ON inbound_webhooks(provider_code, created_at) WHERE processing_status='received';

-- ----------------------------------------------------------------------------
-- 14.8 USAGE METERING — enforce plan_limits + bill overages. The SaaS-billing
-- table v2 forgot: you cannot enforce 'max 5,000 orders/month' without counting.
-- ----------------------------------------------------------------------------
CREATE TABLE usage_counters (
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  metric_code varchar(60) NOT NULL,                    -- mirrors plan_limits.limit_code
  period      date NOT NULL,                           -- month bucket (first day)
  used_value  bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, metric_code, period)
);
-- incremented via UPSERT by app; checked against plan_limits; alerts at 80%.

-- ----------------------------------------------------------------------------
-- 14.9 DATA LIFECYCLE AS DATA — retention policies + tenant export/offboarding
-- jobs (PRD §35.5 retention table + §5.5 archive state, DPDP portability).
-- ----------------------------------------------------------------------------
CREATE TABLE data_retention_policies (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  table_name    varchar(100) NOT NULL UNIQUE,
  active_months integer NOT NULL,                      -- in hot partitions
  archive_months integer,                              -- in S3 parquet (NULL = forever)
  legal_basis   varchar(200),                          -- 'GST 7yr','RBI 10yr','DPDP minimisation'
  action        varchar(20) NOT NULL DEFAULT 'archive' CHECK (action IN ('archive','anonymise','delete','keep_forever')),
  is_active     boolean NOT NULL DEFAULT true
);
CALL add_std_columns('data_retention_policies');

CREATE TABLE data_export_jobs (                        -- tenant data export / DPDP portability / offboarding
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id    uuid REFERENCES tenants(id),
  user_id      uuid REFERENCES users(id),
  job_kind     varchar(30) NOT NULL,                   -- 'tenant_full_export','user_dpdp_export','tenant_offboard'
  status       varchar(20) NOT NULL DEFAULT 'queued',  -- queued|running|completed|failed|expired
  export_media_id uuid REFERENCES media_assets(id),
  expires_at   timestamptz,                            -- download link TTL
  requested_by uuid
);
CALL add_std_columns('data_export_jobs');

-- ----------------------------------------------------------------------------
-- 14.10 CARBON ECONOMY (Phase 3, PRD §17.8/§60.2 — "cover future, skip nothing")
-- ----------------------------------------------------------------------------
CREATE TABLE carbon_projects (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  default_name  varchar(250) NOT NULL,
  methodology   varchar(60) NOT NULL,                  -- 'verra_vcs','gold_standard','no_till','agroforestry','awd_methane'
  registry_ref  varchar(120),
  revenue_split jsonb NOT NULL DEFAULT '{"farmer_bps":6000,"tenant_bps":2500,"platform_bps":1500}',
  status        varchar(20) NOT NULL DEFAULT 'draft'
);
CALL add_std_columns('carbon_projects');

CREATE TABLE carbon_enrolments (                       -- parcel-level participation + MRV evidence
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  project_id   uuid NOT NULL REFERENCES carbon_projects(id),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  farmer_user_id uuid NOT NULL REFERENCES users(id),
  parcel_id    uuid NOT NULL REFERENCES land_parcels(id),
  practices    jsonb NOT NULL DEFAULT '[]',
  mrv_evidence jsonb NOT NULL DEFAULT '{}',            -- satellite/IoT/ground-truth refs
  status       varchar(20) NOT NULL DEFAULT 'enrolled',
  UNIQUE (project_id, parcel_id)
);
CALL add_std_columns('carbon_enrolments');

CREATE TABLE carbon_credits (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  project_id   uuid NOT NULL REFERENCES carbon_projects(id),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  vintage_year smallint NOT NULL,
  tonnes_co2e  numeric(12,3) NOT NULL,
  serial_range varchar(200),
  status       varchar(20) NOT NULL DEFAULT 'issued',  -- issued|listed|sold|retired
  sale_price_minor bigint,
  sale_currency char(3),
  distribution_txn_id uuid                             -- ledger split to farmers/tenant/platform
);
CALL add_std_columns('carbon_credits');

-- ----------------------------------------------------------------------------
-- 14.11 SAFETY MICRO-TABLES the review flagged
-- ----------------------------------------------------------------------------
CREATE TABLE user_blocks (                             -- chat/call safety (PRD §9.13)
  blocker_user_id uuid NOT NULL REFERENCES users(id),
  blocked_user_id uuid NOT NULL REFERENCES users(id),
  reason_id    uuid REFERENCES lookup_values(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_user_id, blocked_user_id)
);

CREATE TABLE user_phone_changes (                      -- account-takeover defence trail
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id      uuid NOT NULL REFERENCES users(id),
  old_phone    varchar(20) NOT NULL,
  new_phone    varchar(20) NOT NULL,
  verified_via varchar(30) NOT NULL,                   -- otp_both|aadhaar_rekyc|support_override
  approved_by  uuid,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_phone_changes_user ON user_phone_changes(user_id, created_at DESC);


-- ============================================================================
-- POST-RUN: re-execute file 13's automation so these tables get RLS+partitions:
--   CALL ensure_partitions(3);  + the RLS DO-block  + grants refresh.
-- ============================================================================
