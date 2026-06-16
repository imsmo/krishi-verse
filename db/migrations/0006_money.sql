-- ============================================================================
-- MIGRATION 0006 — MONEY
-- Source of truth: Database_Architecture/full_platform/05_money.sql (reproduced verbatim)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it
-- in schema_migrations. NEVER edit an applied migration — add a new numbered one.
-- ============================================================================

-- ============================================================================
-- FILE 05 — MONEY: WALLET, DOUBLE-ENTRY LEDGER, PAYMENTS, PAYOUTS,
--           DYNAMIC COMMISSION/TAX RULES, SETTLEMENT, RECONCILIATION
-- Module M05 + PRD §12. The dynamic-rules tables here are what make pricing
-- a config screen instead of a code deploy (Revenue Playbook category rates).
-- ============================================================================

CREATE TYPE payment_status AS ENUM ('initiated','pending','authorized','success','failed','expired','refund_initiated','refunded','partially_refunded');
CREATE TYPE payout_status  AS ENUM ('queued','processing','success','failed','reversed','cancelled');
CREATE TYPE wallet_owner_kind AS ENUM ('user','tenant','platform');

-- ---------- dynamic financial rules ----------------------------------------
CREATE TABLE commission_rules (                       -- Revenue Playbook table as DATA, effective-dated
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id       uuid REFERENCES tenants(id),        -- NULL = platform default for all tenants
  category_id     uuid REFERENCES categories(id),     -- NULL = all categories
  source          varchar(20),                        -- direct|auction|requirement|subscription (NULL = all)
  seller_role_id  uuid REFERENCES roles(id),          -- premium-seller exceptions
  rate_bps        integer NOT NULL,                   -- tenant commission, basis points (350 = 3.5%)
  fixed_minor     bigint NOT NULL DEFAULT 0,          -- or fixed per order
  cap_minor       bigint,                             -- labour ₹100 cap pattern
  platform_share_bps integer NOT NULL,                -- KV share OF the commission (1000 = 10%)
  charged_to      varchar(10) NOT NULL DEFAULT 'seller' CHECK (charged_to IN ('seller','buyer')),
  priority        smallint NOT NULL DEFAULT 100,      -- most specific rule wins (app resolves)
  effective_from  date NOT NULL DEFAULT CURRENT_DATE,
  effective_to    date,
  is_active       boolean NOT NULL DEFAULT true
);
CALL add_std_columns('commission_rules');
CREATE INDEX idx_commrules_lookup ON commission_rules(tenant_id, category_id) WHERE is_active;

CREATE TABLE tax_rules (                              -- GST/TDS/cess as data, per country, effective-dated
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  country_code   char(2) NOT NULL REFERENCES countries(code),
  tax_code       varchar(20) NOT NULL,                -- 'gst','tds_194o','cess'
  category_id    uuid REFERENCES categories(id),
  hsn_prefix     varchar(8),
  rate_bps       integer NOT NULL,
  threshold_minor bigint,                             -- TDS only above threshold
  split          jsonb NOT NULL DEFAULT '{}',         -- {cgst:900, sgst:900} bps
  effective_from date NOT NULL,
  effective_to   date,
  is_active      boolean NOT NULL DEFAULT true
);
CALL add_std_columns('tax_rules');

CREATE TABLE charge_definitions (                     -- every other dynamic fee: delivery slabs, boost prices,
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(), -- buyer platform-fee tiers, setup fees...
  tenant_id     uuid REFERENCES tenants(id),
  charge_code   varchar(60) NOT NULL,                 -- 'buyer_platform_fee','delivery_fee','emd','boost_local'
  calc_method   varchar(20) NOT NULL CHECK (calc_method IN ('flat','percent','slab','per_km','per_unit')),
  config        jsonb NOT NULL,                       -- slabs: [{upto_minor, fee}...]
  currency_code char(3) NOT NULL DEFAULT 'INR',
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to  date,
  is_active     boolean NOT NULL DEFAULT true
);
CALL add_std_columns('charge_definitions');
CREATE INDEX idx_chargedefs ON charge_definitions(charge_code, tenant_id) WHERE is_active;

-- ---------- wallet accounts --------------------------------------------------
CREATE TABLE wallet_accounts (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  owner_kind    wallet_owner_kind NOT NULL,
  owner_user_id uuid REFERENCES users(id),
  owner_tenant_id uuid REFERENCES tenants(id),
  account_code  varchar(40) NOT NULL,                 -- user: main|hold ; tenant: main|commission|hold ;
                                                      -- platform: escrow|fees|gateway|payouts|gst_payable|tds_payable|promo_liability|suspense
  currency_code char(3) NOT NULL DEFAULT 'INR' REFERENCES currencies(code),
  cached_balance_minor bigint NOT NULL DEFAULT 0,
  balance_version bigint NOT NULL DEFAULT 0,
  last_entry_hash varchar(64),
  is_frozen     boolean NOT NULL DEFAULT false,
  freeze_reason text,
  -- HOT-ACCOUNT STRIPING (billions-scale): platform accounts (escrow, fees) are
  -- touched by EVERY transaction → a single row = lock contention ceiling.
  -- Platform accounts are striped into N sub-accounts (shard_no 0..15 by hash
  -- of txn_id); true balance = SUM over stripes. User/tenant accounts: shard 0.
  shard_no      smallint NOT NULL DEFAULT 0 CHECK (shard_no BETWEEN 0 AND 63),
  CHECK ((owner_kind='user' AND owner_user_id IS NOT NULL)
      OR (owner_kind='tenant' AND owner_tenant_id IS NOT NULL)
      OR (owner_kind='platform'))
);
CALL add_std_columns('wallet_accounts');
CREATE UNIQUE INDEX uq_wallet_user ON wallet_accounts(owner_user_id, account_code, currency_code) WHERE owner_kind='user';
CREATE UNIQUE INDEX uq_wallet_tenant ON wallet_accounts(owner_tenant_id, account_code, currency_code) WHERE owner_kind='tenant';
CREATE UNIQUE INDEX uq_wallet_platform ON wallet_accounts(account_code, currency_code, shard_no) WHERE owner_kind='platform';

-- ---------- the ledger (append-only, hash-chained, partitioned, 10yr retention)
CREATE TABLE ledger_transactions (                    -- header: one business money-event
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  txn_type_id   uuid NOT NULL REFERENCES lookup_values(id),  -- lookup 'ledger_txn_type' (dynamic: new money product = INSERT)
  tenant_id     uuid,
  reference_type varchar(50),
  reference_id  uuid,
  description   text,
  idempotency_key varchar(120) UNIQUE,
  initiated_by  uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ledger_txn_ref ON ledger_transactions(reference_type, reference_id);

CREATE TABLE ledger_entries (
  id            bigserial,
  txn_id        uuid NOT NULL,                        -- entries of one txn sum to ZERO (job-verified)
  account_id    uuid NOT NULL,
  tenant_id     uuid,
  amount_minor  bigint NOT NULL CHECK (amount_minor <> 0),  -- +credit / −debit
  currency_code char(3) NOT NULL DEFAULT 'INR',
  balance_after_minor bigint NOT NULL,
  prev_hash     varchar(64),
  entry_hash    varchar(64) NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX idx_ledger_account ON ledger_entries(account_id, created_at DESC);
CREATE INDEX idx_ledger_txn ON ledger_entries(txn_id);

CREATE TABLE reconciliation_runs (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  run_type      varchar(40) NOT NULL,                 -- hourly_internal|daily_gateway|zero_sum_check
  period_start  timestamptz NOT NULL,
  period_end    timestamptz NOT NULL,
  status        varchar(20) NOT NULL DEFAULT 'running',
  checked_count integer,
  mismatches    jsonb NOT NULL DEFAULT '[]',
  finished_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------- gateway side -----------------------------------------------------
CREATE TABLE payments (                               -- money IN (Razorpay etc.)
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  user_id         uuid NOT NULL REFERENCES users(id),
  purpose_id      uuid NOT NULL REFERENCES lookup_values(id), -- lookup 'payment_purpose': wallet_recharge|direct_order|subscription|boost|emd|course
  reference_type  varchar(50),
  reference_id    uuid,
  amount_minor    bigint NOT NULL CHECK (amount_minor > 0),
  currency_code   char(3) NOT NULL DEFAULT 'INR',
  status          payment_status NOT NULL DEFAULT 'initiated',
  provider_code   varchar(60) NOT NULL REFERENCES integration_providers(code),
  gateway_order_id varchar(120),
  gateway_payment_id varchar(120),
  method          varchar(30),                        -- upi|card|netbanking|cod
  idempotency_key varchar(120) UNIQUE NOT NULL,
  failure_code    varchar(60),
  failure_reason  text,
  ledger_txn_id   uuid REFERENCES ledger_transactions(id),
  webhook_payload jsonb
);
CALL add_std_columns('payments');
CREATE INDEX idx_payments_user ON payments(user_id, created_at DESC);
CREATE INDEX idx_payments_open ON payments(status) WHERE status IN ('initiated','pending','authorized');
CREATE UNIQUE INDEX uq_payments_gwid ON payments(gateway_payment_id) WHERE gateway_payment_id IS NOT NULL;

CREATE TABLE payouts (                                -- money OUT (RazorpayX etc.)
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  user_id         uuid REFERENCES users(id),
  bank_account_id uuid NOT NULL REFERENCES bank_accounts(id),
  purpose_id      uuid NOT NULL REFERENCES lookup_values(id), -- 'payout_purpose': settlement|wage|commission|refund|milk_bill|loan_disbursal|claim
  reference_type  varchar(50),
  reference_id    uuid,
  amount_minor    bigint NOT NULL CHECK (amount_minor > 0),
  currency_code   char(3) NOT NULL DEFAULT 'INR',
  status          payout_status NOT NULL DEFAULT 'queued',
  priority        smallint NOT NULL DEFAULT 100,      -- wages get priority lane
  provider_code   varchar(60) NOT NULL REFERENCES integration_providers(code),
  gateway_payout_id varchar(120),
  idempotency_key varchar(120) UNIQUE NOT NULL,
  failure_code    varchar(60),
  failure_reason  text,
  ledger_txn_id   uuid REFERENCES ledger_transactions(id),
  batch_id        uuid
);
CALL add_std_columns('payouts');
CREATE INDEX idx_payouts_queue ON payouts(priority, created_at) WHERE status IN ('queued','processing');
CREATE INDEX idx_payouts_user ON payouts(user_id, created_at DESC);

CREATE TABLE payout_batches (                         -- weekly ambassador run, daily settlement run
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id   uuid REFERENCES tenants(id),
  batch_type  varchar(40) NOT NULL,
  total_minor bigint NOT NULL DEFAULT 0,
  count       integer NOT NULL DEFAULT 0,
  status      varchar(20) NOT NULL DEFAULT 'open',
  executed_at timestamptz
);
CALL add_std_columns('payout_batches');
ALTER TABLE payouts ADD CONSTRAINT fk_payouts_batch FOREIGN KEY (batch_id) REFERENCES payout_batches(id);

-- ---------- settlement statements & buyer invoices (PRD §12.4)
CREATE TABLE settlement_statements (                  -- per seller per cycle
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  seller_user_id uuid NOT NULL REFERENCES users(id),
  statement_no varchar(40) NOT NULL,
  period_start date NOT NULL,
  period_end   date NOT NULL,
  gross_minor  bigint NOT NULL,
  commission_minor bigint NOT NULL,
  tax_minor    bigint NOT NULL,
  net_minor    bigint NOT NULL,
  pdf_media_id uuid REFERENCES media_assets(id),
  UNIQUE (tenant_id, statement_no)
);
CALL add_std_columns('settlement_statements');

CREATE TABLE trade_invoices (                         -- buyer-facing GST invoices for orders
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  order_id     uuid NOT NULL,
  invoice_no   varchar(40) NOT NULL,
  seller_gstin varchar(20),
  buyer_gstin  varchar(20),
  irn          varchar(80),                           -- e-invoice IRN (Phase 2)
  total_minor  bigint NOT NULL,
  tax_breakup  jsonb NOT NULL DEFAULT '{}',
  pdf_media_id uuid REFERENCES media_assets(id),
  UNIQUE (tenant_id, invoice_no)
);
CALL add_std_columns('trade_invoices');
CREATE INDEX idx_trade_inv_order ON trade_invoices(order_id);

