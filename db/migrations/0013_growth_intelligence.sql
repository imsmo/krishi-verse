-- ============================================================================
-- MIGRATION 0013 — GROWTH INTELLIGENCE
-- Source of truth: Database_Architecture/full_platform/12_growth_intelligence.sql (reproduced verbatim)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it
-- in schema_migrations. NEVER edit an applied migration — add a new numbered one.
-- ============================================================================

-- ============================================================================
-- FILE 12 — AMBASSADORS & REFERRALS · MARKET INTELLIGENCE (MANDI PULSE) ·
--           AI GOVERNANCE · MODERATION · TRACEABILITY (FARM-TO-FORK QR)
-- ============================================================================

-- ================= AMBASSADOR NETWORK (PRD §16.10 + Ambassador Brochure) ====
CREATE TABLE ambassador_profiles (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id       uuid NOT NULL UNIQUE REFERENCES users(id),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  cluster_region_ids jsonb NOT NULL DEFAULT '[]',     -- exclusive villages (1-3)
  tier_id       uuid REFERENCES lookup_values(id),    -- 'ambassador_tier': trainee|ambassador|senior|cluster_lead|district_coordinator
  mentor_ambassador_id uuid REFERENCES ambassador_profiles(id), -- cluster-lead hierarchy
  training_completed_at timestamptz,
  kiosk_enabled boolean NOT NULL DEFAULT false,       -- assisted-onboarding kiosk mode
  aeps_enabled  boolean NOT NULL DEFAULT false,       -- micro-ATM operator
  monthly_stipend_minor bigint NOT NULL DEFAULT 0,
  last_activity_at timestamptz,                       -- 60-day inactivity → cluster reassignment
  is_active     boolean NOT NULL DEFAULT true
);
CALL add_std_columns('ambassador_profiles');
CREATE INDEX idx_ambassadors_tenant ON ambassador_profiles(tenant_id) WHERE is_active;

CREATE TABLE commission_plans_ambassador (            -- dynamic earning rules (7 streams as DATA)
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id     uuid REFERENCES tenants(id),          -- NULL = platform default plan
  event_code    varchar(60) NOT NULL,                 -- 'farmer_onboarded','first_txn_30d','listing_assist','first_sale_facilitated','sale_trail','kcc_facilitated','pmsby_enrolled','milestone_bronze'...
  amount_minor  bigint,
  rate_bps      integer,
  cap_minor     bigint,
  conditions    jsonb NOT NULL DEFAULT '{}',          -- {within_days:30, max_per_farmer:5}
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to  date,
  is_active     boolean NOT NULL DEFAULT true
);
CALL add_std_columns('commission_plans_ambassador');

CREATE TABLE ambassador_earnings (                    -- earned events → weekly payout batch
  id            uuid NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id     uuid NOT NULL,
  ambassador_id uuid NOT NULL,
  plan_id       uuid NOT NULL,
  event_code    varchar(60) NOT NULL,
  reference_type varchar(50),
  reference_id  uuid,
  amount_minor  bigint NOT NULL,
  payout_id     uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at),
  UNIQUE (ambassador_id, event_code, reference_id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX idx_amb_earn_unpaid ON ambassador_earnings(ambassador_id) WHERE payout_id IS NULL;

CREATE TABLE referrals (                              -- generic referral engine (farmer→farmer, buyer→buyer)
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  referrer_user_id uuid NOT NULL REFERENCES users(id),
  referee_user_id uuid REFERENCES users(id),
  code            varchar(20) NOT NULL,
  status          varchar(20) NOT NULL DEFAULT 'invited', -- invited|signed_up|activated|rewarded
  reward_rule     jsonb NOT NULL DEFAULT '{}',
  reward_txn_id   uuid,
  UNIQUE (tenant_id, code, referee_user_id)
);
CALL add_std_columns('referrals');

-- ================= MARKET INTELLIGENCE — MANDI PULSE (PRD §16.2) ============
CREATE TABLE mandis (                                 -- physical markets registry
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  default_name varchar(200) NOT NULL,
  region_id    uuid REFERENCES admin_regions(id),
  mandi_code   varchar(40) UNIQUE,                    -- Agmarknet code
  lat          numeric(9,6),
  lng          numeric(9,6),
  is_active    boolean NOT NULL DEFAULT true
);
CALL add_std_columns('mandis');

CREATE TABLE mandi_prices (                           -- ingested + own-transaction aggregates (billions of rows)
  id           bigserial,
  mandi_id     uuid,
  region_id    uuid,
  product_id   uuid NOT NULL,
  grade_option_id uuid,
  price_date   date NOT NULL,
  min_minor    bigint,
  max_minor    bigint,
  modal_minor  bigint NOT NULL,
  unit_code    varchar(20) NOT NULL DEFAULT 'quintal',
  arrivals_qty numeric(14,2),
  source       varchar(40) NOT NULL,                  -- agmarknet|enam|platform_txn|ambassador_manual
  currency_code char(3) NOT NULL DEFAULT 'INR',
  PRIMARY KEY (id, price_date)
) PARTITION BY RANGE (price_date);
CREATE INDEX idx_mandi_prices_lookup ON mandi_prices(product_id, region_id, price_date DESC);
CREATE INDEX idx_mandi_prices_mandi ON mandi_prices(mandi_id, price_date DESC);

CREATE TABLE price_predictions (                      -- AI fair-price bands (P10/P50/P90, PRD §16.2)
  id           bigserial,
  product_id   uuid NOT NULL,
  region_id    uuid NOT NULL,
  grade_option_id uuid,
  target_date  date NOT NULL,
  p10_minor    bigint NOT NULL,
  p50_minor    bigint NOT NULL,
  p90_minor    bigint NOT NULL,
  confidence   numeric(5,4),
  model_version varchar(20) NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX idx_price_pred ON price_predictions(product_id, region_id, target_date);

CREATE TABLE price_alerts (                           -- farmer threshold subscriptions
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  user_id     uuid NOT NULL REFERENCES users(id),
  product_id  uuid NOT NULL REFERENCES products(id),
  region_id   uuid REFERENCES admin_regions(id),
  direction   varchar(6) NOT NULL CHECK (direction IN ('above','below')),
  threshold_minor bigint NOT NULL,
  is_active   boolean NOT NULL DEFAULT true
);
CALL add_std_columns('price_alerts');
CREATE INDEX idx_price_alerts ON price_alerts(product_id, region_id) WHERE is_active;

-- ================= AI GOVERNANCE (PRD §8.3 — every AI decision logged) ======
CREATE TABLE ai_models (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  code          varchar(80) NOT NULL,                 -- 'voice_listing_extract','photo_grading','fraud_score','price_band'
  version       varchar(30) NOT NULL,
  provider      varchar(60),                          -- anthropic|openai|inhouse|ai4bharat
  status        varchar(20) NOT NULL DEFAULT 'shadow',-- shadow|canary|production|retired
  confidence_threshold numeric(5,4),                  -- below → human review queue
  fairness_audit jsonb,
  UNIQUE (code, version)
);
CALL add_std_columns('ai_models');

CREATE TABLE ai_inferences (                          -- audit of every consequential AI decision
  id           bigserial,
  tenant_id    uuid,
  model_id     uuid NOT NULL,
  subject_type varchar(50) NOT NULL,
  subject_id   uuid NOT NULL,
  input_ref    jsonb NOT NULL DEFAULT '{}',           -- pointers, never raw PII
  output       jsonb NOT NULL,
  confidence   numeric(5,4),
  was_overridden boolean NOT NULL DEFAULT false,
  override_by  uuid,
  override_reason text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX idx_ai_inferences_subject ON ai_inferences(subject_type, subject_id);

CREATE TABLE ai_review_queue (                        -- human-in-loop (AI Ops Officer role)
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id    uuid REFERENCES tenants(id),
  inference_id bigint,
  inference_created_at timestamptz,
  queue_kind   varchar(40) NOT NULL,                  -- 'fraud_flag','low_confidence_grade','price_anomaly','dispute_triage'
  priority     smallint NOT NULL DEFAULT 100,
  status       varchar(20) NOT NULL DEFAULT 'pending',-- pending|in_review|accepted|rejected
  reviewer_user_id uuid REFERENCES users(id),
  decision_note text,
  resolved_at  timestamptz
);
CALL add_std_columns('ai_review_queue');
CREATE INDEX idx_ai_queue_open ON ai_review_queue(tenant_id, queue_kind) WHERE status='pending';

-- ================= MODERATION & ABUSE =================
CREATE TABLE moderation_reports (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  reporter_user_id uuid REFERENCES users(id),
  subject_type varchar(50) NOT NULL,                  -- 'listing','review','message','user'
  subject_id   uuid NOT NULL,
  reason_id    uuid NOT NULL REFERENCES lookup_values(id), -- 'report_reason'
  details      text,
  status       varchar(20) NOT NULL DEFAULT 'open',   -- open|actioned|dismissed
  action_taken varchar(40),                           -- hidden|removed|warned|suspended
  handled_by   uuid REFERENCES users(id),
  handled_at   timestamptz
);
CALL add_std_columns('moderation_reports');
CREATE INDEX idx_modreports_open ON moderation_reports(tenant_id) WHERE status='open';

-- ================= TRACEABILITY — FARM-TO-FORK QR (PRD §16.3) ===============
CREATE TABLE trace_lots (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  listing_id    uuid REFERENCES listings(id),
  qr_token      varchar(40) UNIQUE NOT NULL,          -- public scan token
  farmer_user_id uuid NOT NULL REFERENCES users(id),
  parcel_id     uuid REFERENCES land_parcels(id),
  crop_season_id uuid REFERENCES crop_seasons(id),
  declared_inputs jsonb NOT NULL DEFAULT '[]',        -- fertilisers/pesticides used
  certificate_ids jsonb NOT NULL DEFAULT '[]',
  blockchain_anchor varchar(120)                      -- Phase 2/3 hash anchor
);
CALL add_std_columns('trace_lots');

CREATE TABLE trace_events (                           -- listed→sold→picked→delivered journey
  id          bigserial,
  trace_lot_id uuid NOT NULL,
  tenant_id   uuid NOT NULL,
  event_code  varchar(40) NOT NULL,
  meta        jsonb NOT NULL DEFAULT '{}',
  event_hash  varchar(64),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX idx_trace_events_lot ON trace_events(trace_lot_id, created_at);

