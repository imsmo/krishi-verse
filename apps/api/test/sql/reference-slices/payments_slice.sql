-- apps/api/test/sql/reference-slices/payments_slice.sql · REFERENCE ONLY (not wired into tests).
-- A self-contained, readable overview of the payments + wallet/ledger tables (db/migrations 0006
-- + 0017) plus the infra deps they touch, WITHOUT the full 250-table platform. The actual
-- payments integration test builds its DB from the REAL db/migrations + db/seeds via
-- test/integration-global-setup.js — this file is a handy single-file sketch + local sandbox.
--
-- Shows the money invariants the code enforces: ledger entries of one txn sum to ZERO,
-- per-account hash chain, idempotent txn header, tenant isolation via RLS.
BEGIN;
DROP TABLE IF EXISTS ledger_entries, ledger_transactions, wallet_accounts, payments,
  integration_providers, lookup_values, lookup_types, currencies, users, tenants CASCADE;
DROP FUNCTION IF EXISTS current_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS uuid_generate_v7() CASCADE;
DROP FUNCTION IF EXISTS uuid_v7_time(uuid) CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE FUNCTION uuid_generate_v7() RETURNS uuid AS $$ SELECT gen_random_uuid() $$ LANGUAGE sql VOLATILE;
CREATE FUNCTION current_tenant_id() RETURNS uuid AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$ LANGUAGE sql STABLE;
CREATE FUNCTION uuid_v7_time(u uuid) RETURNS timestamptz AS $$
SELECT to_timestamp((('x' || substring(replace(u::text,'-','') from 1 for 12))::bit(48)::bigint) / 1000.0);
$$ LANGUAGE sql IMMUTABLE;

CREATE TABLE tenants    (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE users      (id uuid PRIMARY KEY, phone varchar(20) UNIQUE NOT NULL);
CREATE TABLE currencies (code char(3) PRIMARY KEY, default_name varchar(60) NOT NULL, symbol varchar(8) NOT NULL, minor_units smallint NOT NULL DEFAULT 2, is_active boolean NOT NULL DEFAULT true);
CREATE TABLE lookup_types  (code varchar(60) PRIMARY KEY, default_name varchar(150) NOT NULL, is_tenant_overridable boolean NOT NULL DEFAULT false);
CREATE TABLE lookup_values (id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), type_code varchar(60) NOT NULL REFERENCES lookup_types(code), tenant_id uuid, code varchar(80) NOT NULL, default_name varchar(150) NOT NULL, meta jsonb NOT NULL DEFAULT '{}', sort_order smallint NOT NULL DEFAULT 100, is_active boolean NOT NULL DEFAULT true, UNIQUE (type_code, tenant_id, code));
CREATE TABLE integration_providers (code varchar(60) PRIMARY KEY, default_name varchar(120) NOT NULL, category varchar(40) NOT NULL, is_active boolean NOT NULL DEFAULT true);

-- ---------- wallet accounts (chart of accounts; cached balance + hash-chain head)
CREATE TABLE wallet_accounts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  owner_kind varchar(10) NOT NULL CHECK (owner_kind IN ('user','tenant','platform')),
  owner_user_id uuid REFERENCES users(id), owner_tenant_id uuid REFERENCES tenants(id),
  account_code varchar(40) NOT NULL, currency_code char(3) NOT NULL DEFAULT 'INR' REFERENCES currencies(code),
  cached_balance_minor bigint NOT NULL DEFAULT 0, balance_version bigint NOT NULL DEFAULT 0,
  last_entry_hash varchar(64), is_frozen boolean NOT NULL DEFAULT false, freeze_reason text,
  shard_no smallint NOT NULL DEFAULT 0 CHECK (shard_no BETWEEN 0 AND 63),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX uq_wallet_user     ON wallet_accounts(owner_user_id, account_code, currency_code) WHERE owner_kind='user';
CREATE UNIQUE INDEX uq_wallet_tenant   ON wallet_accounts(owner_tenant_id, account_code, currency_code) WHERE owner_kind='tenant';
CREATE UNIQUE INDEX uq_wallet_platform ON wallet_accounts(account_code, currency_code, shard_no) WHERE owner_kind='platform';

-- ---------- the ledger (append-only, hash-chained; entries of one txn sum to ZERO)
CREATE TABLE ledger_transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), txn_type_id uuid NOT NULL REFERENCES lookup_values(id),
  tenant_id uuid, reference_type varchar(50), reference_id uuid, description text,
  idempotency_key varchar(120) UNIQUE, initiated_by uuid, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE ledger_entries (
  id bigserial, txn_id uuid NOT NULL, account_id uuid NOT NULL, tenant_id uuid,
  amount_minor bigint NOT NULL CHECK (amount_minor <> 0),   -- +credit / −debit
  currency_code char(3) NOT NULL DEFAULT 'INR', balance_after_minor bigint NOT NULL,
  prev_hash varchar(64), entry_hash varchar(64) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at));
CREATE INDEX idx_ledger_account ON ledger_entries(account_id, created_at DESC);
CREATE INDEX idx_ledger_txn ON ledger_entries(txn_id);

-- ---------- gateway money-IN
CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id),
  user_id uuid NOT NULL REFERENCES users(id), purpose_id uuid NOT NULL REFERENCES lookup_values(id),
  reference_type varchar(50), reference_id uuid,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0), refunded_minor bigint NOT NULL DEFAULT 0 CHECK (refunded_minor >= 0 AND refunded_minor <= amount_minor),
  currency_code char(3) NOT NULL DEFAULT 'INR', status varchar(20) NOT NULL DEFAULT 'initiated',
  provider_code varchar(60) NOT NULL REFERENCES integration_providers(code), gateway_order_id varchar(120),
  gateway_payment_id varchar(120), method varchar(30), idempotency_key varchar(120) UNIQUE NOT NULL,
  failure_code varchar(60), failure_reason text, ledger_txn_id uuid REFERENCES ledger_transactions(id),
  webhook_payload jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX uq_payments_gwid ON payments(gateway_payment_id) WHERE gateway_payment_id IS NOT NULL;

-- RLS: payments are tenant-private. NOTE: in production wallet_accounts/ledger_* are EXCLUDED from
-- the automatic tenant RLS (migration 0014) and live under a stricter kv_wallet regime — only the
-- wallet service writes them. Here we tenant-scope payments to demonstrate cross-tenant denial.
ALTER TABLE payments ENABLE ROW LEVEL SECURITY; ALTER TABLE payments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON payments USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());

-- seed: currency + the lookup vocab + providers the payments/wallet code resolves by code
INSERT INTO currencies (code, default_name, symbol) VALUES ('INR','Indian Rupee','₹') ON CONFLICT DO NOTHING;
INSERT INTO lookup_types (code, default_name) VALUES ('payment_purpose','Payment purpose'),('ledger_txn_type','Ledger txn type') ON CONFLICT DO NOTHING;
INSERT INTO lookup_values (type_code, tenant_id, code, default_name) VALUES
  ('payment_purpose', NULL, 'direct_order', 'Direct order'),
  ('ledger_txn_type', NULL, 'order_payment', 'Order payment'),
  ('ledger_txn_type', NULL, 'escrow_release', 'Escrow release') ON CONFLICT DO NOTHING;
INSERT INTO integration_providers (code, default_name, category) VALUES
  ('sandbox','Sandbox gateway','payment'),('razorpay','Razorpay','payment') ON CONFLICT DO NOTHING;
COMMIT;
