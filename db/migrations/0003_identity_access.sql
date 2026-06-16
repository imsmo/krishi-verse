-- ============================================================================
-- MIGRATION 0003 — IDENTITY ACCESS
-- Source of truth: Database_Architecture/full_platform/02_identity_access.sql (reproduced verbatim)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it
-- in schema_migrations. NEVER edit an applied migration — add a new numbered one.
-- ============================================================================

-- ============================================================================
-- FILE 02 — IDENTITY, DYNAMIC RBAC (24+ roles), KYC, ADDRESSES, RISK, CONSENT
-- Roles & permissions are TABLES (L1): role #25 is an INSERT, not a release.
-- ============================================================================

CREATE TYPE user_status AS ENUM ('active','pending_verification','suspended','restricted','soft_deleted');
CREATE TYPE kyc_status  AS ENUM ('none','pending','verified','rejected','expired');

-- ---------- users: ONE global identity per human (phone), tenant-independent
CREATE TABLE users (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  phone             varchar(20) UNIQUE NOT NULL,      -- E.164
  phone_verified_at timestamptz,
  full_name         varchar(200),
  gender            varchar(15),
  dob               date,                             -- 18+ rules (worker, regulated products)
  language_code     varchar(8) NOT NULL DEFAULT 'hi' REFERENCES languages(code),
  country_code      char(2) NOT NULL DEFAULT 'IN' REFERENCES countries(code),
  email             varchar(200),
  email_verified_at timestamptz,
  photo_media_id    uuid REFERENCES media_assets(id),
  status            user_status NOT NULL DEFAULT 'active',
  -- PII vault refs ONLY — raw Aadhaar/PAN never in this database (UIDAI/DPDP)
  aadhaar_last4     varchar(4),
  aadhaar_vault_ref varchar(200),
  pan_vault_ref     varchar(200),
  is_test           boolean NOT NULL DEFAULT false,
  last_active_at    timestamptz
);
CALL add_std_columns('users');
CREATE INDEX idx_users_name_trgm ON users USING gin (full_name gin_trgm_ops);
CREATE INDEX idx_users_status ON users(status) WHERE status <> 'active';

-- ---------- DYNAMIC RBAC --------------------------------------------------
CREATE TABLE roles (                                  -- the 24 PRD roles + future ones, as data
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  code          varchar(50) UNIQUE NOT NULL,          -- 'farmer','vyapari','customer','worker','ambassador','fpo_coordinator','pashupalak','dairy_farmer','vet','banker','insurance_agent','equipment_owner','gov_officer','sardar','instructor','support_agent','auditor','ai_ops','delivery_partner','pharma_store','organic_store','tenant_staff','tenant_admin','super_admin'
  default_name  varchar(100) NOT NULL,
  scope         varchar(10) NOT NULL DEFAULT 'tenant' CHECK (scope IN ('tenant','platform')),
  requires_kyc  boolean NOT NULL DEFAULT false,
  requires_approval boolean NOT NULL DEFAULT false,
  module_code   varchar(10),                          -- primary PRD module
  is_active     boolean NOT NULL DEFAULT true
);
CALL add_std_columns('roles');

CREATE TABLE permissions (                            -- atomic actions (PRD §10 matrix as data)
  code         varchar(80) PRIMARY KEY,               -- 'listing.create','listing.approve','wallet.adjust','user.impersonate'
  default_name varchar(150) NOT NULL,
  module_code  varchar(10)
);

CREATE TABLE role_permissions (
  role_id         uuid NOT NULL REFERENCES roles(id),
  permission_code varchar(80) NOT NULL REFERENCES permissions(code),
  PRIMARY KEY (role_id, permission_code)
);

CREATE TABLE user_tenant_roles (                      -- person × tenant × role (PRD §4.3 multi-role)
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id      uuid NOT NULL REFERENCES users(id),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  role_id      uuid NOT NULL REFERENCES roles(id),
  kyc_status   kyc_status NOT NULL DEFAULT 'none',
  is_active    boolean NOT NULL DEFAULT true,
  role_data    jsonb NOT NULL DEFAULT '{}',           -- descriptive role extras only (L8)
  approved_by  uuid REFERENCES users(id),
  approved_at  timestamptz,
  UNIQUE (user_id, tenant_id, role_id)
);
CALL add_std_columns('user_tenant_roles');
CREATE INDEX idx_utr_tenant_role ON user_tenant_roles(tenant_id, role_id) WHERE is_active AND deleted_at IS NULL;
CREATE INDEX idx_utr_user ON user_tenant_roles(user_id);

CREATE TABLE staff_permission_overrides (             -- per-staff fine-grain (PRD: scoped staff permissions)
  user_tenant_role_id uuid NOT NULL REFERENCES user_tenant_roles(id),
  permission_code     varchar(80) NOT NULL REFERENCES permissions(code),
  is_granted          boolean NOT NULL,
  PRIMARY KEY (user_tenant_role_id, permission_code)
);

-- ---------- KYC documents (dynamic doc types via lookups)
CREATE TABLE kyc_documents (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id     uuid REFERENCES tenants(id),
  user_id       uuid NOT NULL REFERENCES users(id),
  role_id       uuid REFERENCES roles(id),            -- doc submitted for which role
  doc_type_id   uuid NOT NULL REFERENCES lookup_values(id),  -- lookup 'doc_type': aadhaar|pan|land_record|license_form20|organic_cert|vet_degree|dl|rc...
  media_id      uuid NOT NULL REFERENCES media_assets(id),
  doc_no_masked varchar(50),
  issued_by     varchar(150),
  valid_from    date,
  valid_until   date,                                 -- expiry tracking + renewal reminders (PRD §9.1)
  status        kyc_status NOT NULL DEFAULT 'pending',
  verify_method varchar(30),                          -- 'manual','karza_api','digilocker'
  verify_payload jsonb,
  reviewed_by   uuid REFERENCES users(id),
  reviewed_at   timestamptz,
  reject_reason text
);
CALL add_std_columns('kyc_documents');
CREATE INDEX idx_kyc_user ON kyc_documents(user_id);
CREATE INDEX idx_kyc_pending ON kyc_documents(tenant_id, status) WHERE status = 'pending';
CREATE INDEX idx_kyc_expiring ON kyc_documents(valid_until) WHERE status = 'verified';

-- ---------- addresses (multiple per user; PRD address book)
CREATE TABLE addresses (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id     uuid REFERENCES users(id),
  tenant_id   uuid REFERENCES tenants(id),            -- tenant business addresses too
  label_id    uuid REFERENCES lookup_values(id),      -- lookup 'address_label': home|farm|shop|warehouse|delivery
  line1       varchar(250) NOT NULL,
  line2       varchar(250),
  village     varchar(150),
  region_id   uuid REFERENCES admin_regions(id),
  pincode     varchar(10),
  country_code char(2) NOT NULL DEFAULT 'IN' REFERENCES countries(code),
  lat         numeric(9,6),
  lng         numeric(9,6),
  contact_name  varchar(150),
  contact_phone varchar(20),
  is_default  boolean NOT NULL DEFAULT false
);
CALL add_std_columns('addresses');
CREATE INDEX idx_addresses_user ON addresses(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_addresses_pincode ON addresses(pincode);

-- ---------- bank/payout destinations (tokenised; penny-verified)
CREATE TABLE bank_accounts (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id         uuid REFERENCES users(id),
  tenant_id       uuid REFERENCES tenants(id),        -- tenant settlement accounts
  account_kind    varchar(10) NOT NULL CHECK (account_kind IN ('bank','upi')),
  upi_id          varchar(100),
  account_last4   varchar(4),
  ifsc            varchar(11),
  holder_name     varchar(200),
  vault_ref       varchar(200) NOT NULL,              -- gateway fund-account token
  penny_verified_at timestamptz,
  is_primary      boolean NOT NULL DEFAULT false,
  CHECK (user_id IS NOT NULL OR tenant_id IS NOT NULL)
);
CALL add_std_columns('bank_accounts');
CREATE INDEX idx_bank_user ON bank_accounts(user_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_bank_primary_user ON bank_accounts(user_id) WHERE is_primary AND deleted_at IS NULL AND user_id IS NOT NULL;

-- ---------- sessions & devices
CREATE TABLE devices (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id         uuid NOT NULL REFERENCES users(id),
  fingerprint     varchar(200) NOT NULL,
  platform        varchar(20),                        -- android|ios|web
  model           varchar(100),
  os_version      varchar(40),
  app_version     varchar(20),
  push_token      varchar(300),
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, fingerprint)
);
CALL add_std_columns('devices');

CREATE TABLE sessions (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id            uuid NOT NULL REFERENCES users(id),
  device_id          uuid REFERENCES devices(id),
  refresh_token_hash varchar(128) NOT NULL,
  ip                 inet,
  expires_at         timestamptz NOT NULL,
  revoked_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  last_seen_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_user ON sessions(user_id) WHERE revoked_at IS NULL;
-- OTPs: Redis only (TTL), never PostgreSQL.

CREATE TABLE login_events (                           -- security trail (PRD §13.6)
  id          uuid NOT NULL DEFAULT uuid_generate_v7(),
  user_id     uuid,
  phone       varchar(20),
  succeeded   boolean NOT NULL,
  method      varchar(20) NOT NULL,                   -- 'otp','refresh','assisted'
  ip          inet,
  device_fingerprint varchar(200),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX idx_login_events_user ON login_events(user_id, created_at DESC);

-- ---------- DPDP consent (append-only history)
CREATE TABLE consent_purposes (                       -- dynamic purpose registry
  code         varchar(60) PRIMARY KEY,               -- 'marketing','ai_training','data_sharing','location'
  default_name varchar(150) NOT NULL,
  is_mandatory boolean NOT NULL DEFAULT false,
  current_version varchar(20) NOT NULL DEFAULT 'v1'
);
CREATE TABLE consents (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id      uuid NOT NULL REFERENCES users(id),
  purpose_code varchar(60) NOT NULL REFERENCES consent_purposes(code),
  version      varchar(20) NOT NULL,
  granted      boolean NOT NULL,
  channel      varchar(30) NOT NULL,                  -- 'app','web','ambassador_assisted','ivr'
  assisted_by  uuid REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_consents_user ON consents(user_id, purpose_code, created_at DESC);

CREATE TABLE data_subject_requests (                  -- DPDP rights workflow (access/erase/port)
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id      uuid NOT NULL REFERENCES users(id),
  request_type varchar(20) NOT NULL CHECK (request_type IN ('access','erasure','correction','portability')),
  status       varchar(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','completed','rejected')),
  cooling_ends_at timestamptz,                        -- 90-day erasure cooling
  resolution   text,
  export_media_id uuid REFERENCES media_assets(id)
);
CALL add_std_columns('data_subject_requests');

-- ---------- risk scoring (PRD §13.4: 0–100, daily recompute)
CREATE TABLE risk_scores (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id    uuid REFERENCES tenants(id),
  user_id      uuid NOT NULL REFERENCES users(id),
  score        smallint NOT NULL CHECK (score BETWEEN 0 AND 100),
  band         varchar(15) NOT NULL,                  -- trusted|standard|caution|restricted|blocked
  factors      jsonb NOT NULL DEFAULT '{}',           -- explainability (PRD AI governance)
  computed_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);
CREATE TABLE risk_events (
  id          uuid NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id   uuid,
  user_id     uuid NOT NULL,
  event_code  varchar(60) NOT NULL,                   -- 'dispute_lost','fake_listing','duplicate_kyc','same_ip_bidding'
  weight      smallint NOT NULL,
  reference_type varchar(50),
  reference_id   uuid,
  meta        jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX idx_risk_events_user ON risk_events(user_id, created_at DESC);

