-- ============================================================================
-- MIGRATION 0011 — FINTECH SCHEMES
-- Source of truth: Database_Architecture/full_platform/10_fintech_schemes.sql (reproduced verbatim)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it
-- in schema_migrations. NEVER edit an applied migration — add a new numbered one.
-- ============================================================================

-- ============================================================================
-- FILE 10 — AGRI-FINTECH (M19, PRD §22) + GOVERNMENT SCHEMES/DBT (M17, PRD §20)
-- Originator-only model: partners carry risk; we hold applications, scoring,
-- servicing data. Schemes engine is fully dynamic — 200+ schemes as DATA.
-- ============================================================================

CREATE TYPE loan_app_status AS ENUM ('draft','submitted','docs_pending','under_review','approved','rejected','withdrawn','disbursed','closed');
CREATE TYPE loan_status     AS ENUM ('active','overdue','restructured','closed','written_off','transferred');
CREATE TYPE policy_status   AS ENUM ('proposed','active','lapsed','cancelled','expired','claimed');
CREATE TYPE claim_status    AS ENUM ('intimated','docs_pending','survey_scheduled','surveyed','approved','partially_approved','rejected','paid','closed');
CREATE TYPE application_status AS ENUM ('draft','submitted','under_verification','clarification_needed','approved','rejected','disbursed','closed','appealed');

-- ---------- financial partners (banks/NBFCs/insurers/AMCs — dynamic panel)
CREATE TABLE financial_partners (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  code          varchar(60) UNIQUE NOT NULL,          -- 'sbi','bob','samunnati','icici_lombard'
  default_name  varchar(200) NOT NULL,
  partner_kind  varchar(20) NOT NULL CHECK (partner_kind IN ('bank','nbfc','mfi','insurer','amc','gold_loan')),
  regulator_ref varchar(60),                          -- RBI/IRDAI licence no
  api_provider_code varchar(60) REFERENCES integration_providers(code),
  sla           jsonb NOT NULL DEFAULT '{}',          -- decision/disbursal/claim TATs
  is_active     boolean NOT NULL DEFAULT true
);
CALL add_std_columns('financial_partners');

-- ---------- credit scoring (PRD §22.2: explainable, consent-gated)
CREATE TABLE credit_scores (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id      uuid NOT NULL REFERENCES users(id),
  tenant_id    uuid REFERENCES tenants(id),
  score        smallint NOT NULL CHECK (score BETWEEN 300 AND 900),
  band         varchar(15) NOT NULL,                  -- excellent|good|fair|poor|unscored
  factors      jsonb NOT NULL,                        -- weighted components (user-visible, PRD right-to-explanation)
  model_version varchar(20) NOT NULL,
  computed_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_credit_scores_user ON credit_scores(user_id, computed_at DESC);

CREATE TABLE credit_score_consents (                  -- per-application sharing consent
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id      uuid NOT NULL REFERENCES users(id),
  partner_id   uuid NOT NULL REFERENCES financial_partners(id),
  purpose_ref  varchar(120) NOT NULL,                 -- loan application id etc.
  granted_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz
);

-- ---------- loan products & applications (25 product categories as DATA)
CREATE TABLE loan_products (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  partner_id    uuid NOT NULL REFERENCES financial_partners(id),
  product_kind_id uuid NOT NULL REFERENCES lookup_values(id), -- 'loan_kind': kcc|crop|tractor|dairy|whr|gold|bnpl|shg|jlg|modular|solar|invoice_discount|tenant_wc
  default_name  varchar(200) NOT NULL,
  currency_code char(3) NOT NULL DEFAULT 'INR',
  min_amount_minor bigint NOT NULL,
  max_amount_minor bigint NOT NULL,
  interest_apr_bps integer NOT NULL,
  subvention_bps integer NOT NULL DEFAULT 0,          -- govt interest subsidy
  tenure_months_min smallint,
  tenure_months_max smallint,
  ltv_bps       integer,                              -- WHR/gold loans
  collateral_kind varchar(30),                        -- none|nwr|gold|hypothecation|group_guarantee
  origination_fee_minor bigint NOT NULL DEFAULT 0,    -- OUR revenue per loan
  origination_fee_bps integer NOT NULL DEFAULT 0,
  eligibility_rules jsonb NOT NULL DEFAULT '{}',      -- machine-evaluable criteria
  required_doc_type_ids jsonb NOT NULL DEFAULT '[]',
  repayment_style varchar(20) NOT NULL DEFAULT 'emi', -- emi|bullet|harvest_aligned|milk_bill_deduction
  is_active     boolean NOT NULL DEFAULT true
);
CALL add_std_columns('loan_products');

CREATE TABLE loan_applications (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  applicant_user_id uuid NOT NULL REFERENCES users(id),
  product_id    uuid NOT NULL REFERENCES loan_products(id),
  amount_requested_minor bigint NOT NULL,
  purpose_text  varchar(300),
  status        loan_app_status NOT NULL DEFAULT 'draft',
  credit_score_id uuid REFERENCES credit_scores(id),
  group_id      uuid,                                 -- SHG/JLG joint applications
  nwr_id        uuid REFERENCES nwr_receipts(id),     -- pledge collateral
  partner_app_ref varchar(120),
  decision_at   timestamptz,
  decision_note text,
  amount_approved_minor bigint,
  cooling_off_until timestamptz                       -- 24h cancel window (PRD §59.4 anti-predatory)
);
CALL add_std_columns('loan_applications');
CREATE INDEX idx_loanapps_user ON loan_applications(applicant_user_id, created_at DESC);
CREATE INDEX idx_loanapps_open ON loan_applications(tenant_id, status) WHERE status IN ('submitted','docs_pending','under_review');
ALTER TABLE nwr_receipts ADD CONSTRAINT fk_nwr_loan FOREIGN KEY (pledged_loan_id) REFERENCES loan_applications(id);

CREATE TABLE loans (                                  -- post-disbursal servicing mirror
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  application_id uuid NOT NULL UNIQUE REFERENCES loan_applications(id),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  borrower_user_id uuid NOT NULL REFERENCES users(id),
  partner_id    uuid NOT NULL REFERENCES financial_partners(id),
  principal_minor bigint NOT NULL,
  interest_apr_bps integer NOT NULL,
  disbursed_at  date NOT NULL,
  maturity_date date,
  status        loan_status NOT NULL DEFAULT 'active',
  outstanding_minor bigint NOT NULL,
  next_due_date date,
  origination_fee_txn_id uuid                         -- our fee posted to ledger
);
CALL add_std_columns('loans');
CREATE INDEX idx_loans_borrower ON loans(borrower_user_id);
CREATE INDEX idx_loans_due ON loans(next_due_date) WHERE status IN ('active','overdue');

CREATE TABLE loan_repayments (
  id          uuid NOT NULL DEFAULT uuid_generate_v7(),
  loan_id     uuid NOT NULL,
  tenant_id   uuid NOT NULL,
  due_date    date NOT NULL,
  amount_due_minor bigint NOT NULL,
  amount_paid_minor bigint NOT NULL DEFAULT 0,
  paid_at     timestamptz,
  channel     varchar(30),                            -- upi|milk_bill_deduction|harvest_settlement|cash_partner
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX idx_repayments_loan ON loan_repayments(loan_id, due_date);

CREATE TABLE bnpl_limits (                            -- input financing (PRD §22.13)
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id      uuid NOT NULL REFERENCES users(id),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  partner_id   uuid NOT NULL REFERENCES financial_partners(id),
  limit_minor  bigint NOT NULL,
  used_minor   bigint NOT NULL DEFAULT 0,
  harvest_due_date date,
  status       varchar(20) NOT NULL DEFAULT 'active',
  UNIQUE (user_id, tenant_id, partner_id)
);
CALL add_std_columns('bnpl_limits');

-- ---------- insurance (crop/livestock/equipment/health/life/parametric)
CREATE TABLE insurance_products (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  partner_id    uuid NOT NULL REFERENCES financial_partners(id),
  product_kind_id uuid NOT NULL REFERENCES lookup_values(id), -- 'insurance_kind': pmfby|wbcis|cattle|poultry|equipment|polyhouse|pmsby|pmjjby|health|term|parametric_weather
  default_name  varchar(200) NOT NULL,
  premium_calc  jsonb NOT NULL,                       -- {pct_of_sum_insured} | {flat_minor} | parametric trigger terms
  sum_insured_rules jsonb NOT NULL DEFAULT '{}',
  govt_subsidy_bps integer NOT NULL DEFAULT 0,
  our_commission_bps integer NOT NULL DEFAULT 0,      -- distribution revenue
  is_parametric boolean NOT NULL DEFAULT false,
  is_active     boolean NOT NULL DEFAULT true
);
CALL add_std_columns('insurance_products');
ALTER TABLE worker_insurance_enrolments ADD CONSTRAINT fk_wins_product FOREIGN KEY (product_id) REFERENCES insurance_products(id);

CREATE TABLE insurance_policies (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  holder_user_id uuid NOT NULL REFERENCES users(id),
  product_id    uuid NOT NULL REFERENCES insurance_products(id),
  policy_no     varchar(80),
  subject_type  varchar(30) NOT NULL,                 -- 'crop_season','animal','equipment','person','shipment'
  subject_id    uuid,
  sum_insured_minor bigint NOT NULL,
  premium_minor bigint NOT NULL,
  premium_payment_id uuid REFERENCES payments(id),
  status        policy_status NOT NULL DEFAULT 'proposed',
  valid_from    date NOT NULL,
  valid_until   date NOT NULL,
  parametric_triggers jsonb                            -- auto-payout conditions
);
CALL add_std_columns('insurance_policies');
CREATE INDEX idx_policies_holder ON insurance_policies(holder_user_id);
CREATE INDEX idx_policies_subject ON insurance_policies(subject_type, subject_id);
ALTER TABLE animals ADD CONSTRAINT fk_animals_policy FOREIGN KEY (insurance_policy_id) REFERENCES insurance_policies(id);
ALTER TABLE equipment_assets ADD CONSTRAINT fk_equip_policy FOREIGN KEY (insurance_policy_id) REFERENCES insurance_policies(id);

CREATE TABLE insurance_claims (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  policy_id    uuid NOT NULL REFERENCES insurance_policies(id),
  claimant_user_id uuid NOT NULL REFERENCES users(id),
  event_date   date NOT NULL,
  event_type_id uuid REFERENCES lookup_values(id),    -- 'claim_event': drought|flood|hail|pest|death|theft|fire|accident
  description  text,
  status       claim_status NOT NULL DEFAULT 'intimated',
  intimated_within_72h boolean,
  surveyor_user_id uuid REFERENCES users(id),
  survey_report jsonb,
  approved_minor bigint,
  payout_id    uuid REFERENCES payouts(id),
  closed_at    timestamptz
);
CALL add_std_columns('insurance_claims');
CREATE INDEX idx_claims_policy ON insurance_claims(policy_id);
CREATE INDEX idx_claims_open ON insurance_claims(tenant_id, status) WHERE status NOT IN ('paid','closed','rejected');

-- ---------- SHG / JLG groups (PRD §22.10-22.11, §29)
CREATE TABLE finance_groups (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  group_kind   varchar(10) NOT NULL CHECK (group_kind IN ('shg','jlg')),
  default_name varchar(150) NOT NULL,
  region_id    uuid REFERENCES admin_regions(id),
  nrlm_code    varchar(40),
  bank_account_id uuid REFERENCES bank_accounts(id),
  meeting_cadence varchar(15) NOT NULL DEFAULT 'weekly',
  grade        varchar(10),                           -- bank-linkage rating
  is_active    boolean NOT NULL DEFAULT true
);
CALL add_std_columns('finance_groups');
ALTER TABLE loan_applications ADD CONSTRAINT fk_loanapp_group FOREIGN KEY (group_id) REFERENCES finance_groups(id);

CREATE TABLE finance_group_members (
  group_id   uuid NOT NULL REFERENCES finance_groups(id),
  user_id    uuid NOT NULL REFERENCES users(id),
  role       varchar(20) NOT NULL DEFAULT 'member',   -- member|president|secretary|treasurer
  joined_at  date NOT NULL DEFAULT CURRENT_DATE,
  left_at    date,
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE group_ledger_entries (                   -- internal savings/lending book (lightweight)
  id          uuid NOT NULL DEFAULT uuid_generate_v7(),
  group_id    uuid NOT NULL,
  tenant_id   uuid NOT NULL,
  member_user_id uuid,
  entry_kind  varchar(30) NOT NULL,                   -- saving_deposit|internal_loan|internal_repayment|bank_credit|expense
  amount_minor bigint NOT NULL,
  note        varchar(250),
  meeting_date date,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX idx_group_ledger ON group_ledger_entries(group_id, created_at DESC);

-- ============================================================================
-- GOVERNMENT SCHEMES ENGINE (M17) — 200+ schemes, 20 categories, all as DATA
-- ============================================================================
CREATE TABLE scheme_authorities (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  default_name varchar(200) NOT NULL,                 -- 'Ministry of Agriculture','Gujarat Agri Dept','NABARD'
  level        varchar(15) NOT NULL CHECK (level IN ('central','state','district','body')),
  region_id    uuid REFERENCES admin_regions(id)
);
CALL add_std_columns('scheme_authorities');

CREATE TABLE schemes (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  code          varchar(60) UNIQUE NOT NULL,          -- 'pm_kisan','pmfby','kcc','smam','pmksy','kalia',...
  default_name  varchar(250) NOT NULL,
  authority_id  uuid NOT NULL REFERENCES scheme_authorities(id),
  category_id   uuid NOT NULL REFERENCES lookup_values(id),  -- 'scheme_category': income_support|insurance|credit|mechanisation|irrigation|livestock|fisheries|processing|women|tribal|pension|subsidy
  benefit_summary jsonb NOT NULL,                     -- {type:'dbt_annual', amount_minor:600000, instalments:3}
  eligibility_rules jsonb NOT NULL,                   -- machine-evaluable: {landholding_max_acres, roles:[], gender, age...}
  required_doc_type_ids jsonb NOT NULL DEFAULT '[]',
  application_window jsonb,                           -- {opens:'06-01', closes:'07-31', season:'kharif'}
  applicable_region_ids jsonb NOT NULL DEFAULT '[]',  -- empty = national
  processing_fee_minor bigint NOT NULL DEFAULT 0,     -- govt-tenant per-application revenue
  source_url    varchar(400),
  version       integer NOT NULL DEFAULT 1,           -- rules change → new version (PRD risk R18)
  is_active     boolean NOT NULL DEFAULT true
);
CALL add_std_columns('schemes');
CREATE INDEX idx_schemes_category ON schemes(category_id) WHERE is_active;

CREATE TABLE scheme_applications (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  scheme_id     uuid NOT NULL REFERENCES schemes(id),
  scheme_version integer NOT NULL,                    -- rules snapshot integrity
  applicant_user_id uuid NOT NULL REFERENCES users(id),
  assisted_by   uuid REFERENCES users(id),            -- ambassador-assisted
  status        application_status NOT NULL DEFAULT 'draft',
  form_data     jsonb NOT NULL DEFAULT '{}',
  govt_app_ref  varchar(120),                         -- portal acknowledgement no
  eligibility_check jsonb,                            -- AI checker output + confidence
  submitted_at  timestamptz,
  decided_at    timestamptz,
  rejection_reason text
);
CALL add_std_columns('scheme_applications');
CREATE INDEX idx_schemeapps_user ON scheme_applications(applicant_user_id, created_at DESC);
CREATE INDEX idx_schemeapps_open ON scheme_applications(tenant_id, status) WHERE status NOT IN ('closed','rejected','disbursed');

CREATE TABLE scheme_application_events (
  id             uuid NOT NULL DEFAULT uuid_generate_v7(),
  application_id uuid NOT NULL,
  tenant_id      uuid NOT NULL,
  from_status    application_status,
  to_status      application_status NOT NULL,
  note           text,
  actor_user_id  uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX idx_schemeapp_events ON scheme_application_events(application_id, created_at);

CREATE TABLE dbt_transfers (                          -- benefit credits observed/confirmed (PFMS)
  id             uuid NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id      uuid,
  application_id uuid,
  user_id        uuid NOT NULL,
  scheme_id      uuid NOT NULL,
  amount_minor   bigint NOT NULL,
  instalment_no  smallint,
  credited_on    date NOT NULL,
  pfms_ref       varchar(120),
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX idx_dbt_user ON dbt_transfers(user_id, credited_on DESC);

