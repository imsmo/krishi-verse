-- apps/api/test/sql/reference-slices/auctions_slice.sql · REFERENCE ONLY (not wired into tests).
-- A self-contained, readable overview of the auctions tables (db/migrations 0005) + the EMD wallet
-- bits they touch, WITHOUT the full 250-table platform. The actual auctions integration test builds
-- its DB from the REAL db/migrations + db/seeds (test/integration-global-setup.js) — this file is a
-- handy single-file sketch + local sandbox.
--
-- Shows the auction money flow: a bid HOLDS earnest money (EMD) via the ledger (user main → hold,
-- emd_txn_id), bids are APPEND-ONLY, and the auction row is the concurrency point (FOR UPDATE).
BEGIN;
DROP TABLE IF EXISTS auction_events, bids, auctions, ledger_entries, ledger_transactions,
  wallet_accounts, listings, lookup_values, lookup_types, units, currencies, users, tenants CASCADE;
DROP FUNCTION IF EXISTS current_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS uuid_generate_v7() CASCADE;
DROP FUNCTION IF EXISTS uuid_v7_time(uuid) CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE FUNCTION uuid_generate_v7() RETURNS uuid AS $$ SELECT gen_random_uuid() $$ LANGUAGE sql VOLATILE;
CREATE FUNCTION current_tenant_id() RETURNS uuid AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$ LANGUAGE sql STABLE;
CREATE FUNCTION uuid_v7_time(u uuid) RETURNS timestamptz AS $$
SELECT to_timestamp((('x' || substring(replace(u::text,'-','') from 1 for 12))::bit(48)::bigint) / 1000.0);
$$ LANGUAGE sql IMMUTABLE;

CREATE TABLE tenants (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE users   (id uuid PRIMARY KEY, phone varchar(20) UNIQUE NOT NULL);
CREATE TABLE currencies (code char(3) PRIMARY KEY, default_name varchar(60) NOT NULL, symbol varchar(8) NOT NULL, minor_units smallint NOT NULL DEFAULT 2, is_active boolean NOT NULL DEFAULT true);
CREATE TABLE units (code varchar(20) PRIMARY KEY, default_name varchar(60) NOT NULL, unit_class varchar(20) NOT NULL, is_active boolean NOT NULL DEFAULT true);
CREATE TABLE lookup_types  (code varchar(60) PRIMARY KEY, default_name varchar(150) NOT NULL);
CREATE TABLE lookup_values (id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), type_code varchar(60) NOT NULL REFERENCES lookup_types(code), tenant_id uuid, code varchar(80) NOT NULL, default_name varchar(150) NOT NULL, meta jsonb NOT NULL DEFAULT '{}', sort_order smallint NOT NULL DEFAULT 100, is_active boolean NOT NULL DEFAULT true, UNIQUE (type_code, tenant_id, code));

-- listings: only the columns ListingService.getById reads (auction references its listing + seller)
CREATE TABLE listings (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), seller_user_id uuid NOT NULL,
  product_id uuid NOT NULL, category_id uuid NOT NULL, title varchar(250) NOT NULL,
  quantity_total numeric(14,3) NOT NULL, quantity_available numeric(14,3) NOT NULL, min_order_qty numeric(14,3) NOT NULL DEFAULT 1,
  unit_code varchar(20) NOT NULL, price_minor bigint NOT NULL, currency_code char(3) NOT NULL DEFAULT 'INR',
  organic_claim varchar(20) NOT NULL DEFAULT 'none', status varchar(15) NOT NULL DEFAULT 'published', sale_type varchar(15) NOT NULL DEFAULT 'auction',
  pincode varchar(10), region_id uuid, lat double precision, lng double precision, visibility varchar(15) NOT NULL DEFAULT 'public',
  ai_extracted boolean NOT NULL DEFAULT false, publish_at timestamptz, published_at timestamptz, expires_at timestamptz, version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz);

-- wallet accounts + ledger (EMD hold/release) — see payments_slice.sql for the full ledger picture
CREATE TABLE wallet_accounts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), owner_kind varchar(10) NOT NULL CHECK (owner_kind IN ('user','tenant','platform')),
  owner_user_id uuid REFERENCES users(id), owner_tenant_id uuid REFERENCES tenants(id), account_code varchar(40) NOT NULL,
  currency_code char(3) NOT NULL DEFAULT 'INR' REFERENCES currencies(code), cached_balance_minor bigint NOT NULL DEFAULT 0,
  balance_version bigint NOT NULL DEFAULT 0, last_entry_hash varchar(64), is_frozen boolean NOT NULL DEFAULT false, shard_no smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX uq_wallet_user ON wallet_accounts(owner_user_id, account_code, currency_code) WHERE owner_kind='user';
CREATE TABLE ledger_transactions (id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), txn_type_id uuid NOT NULL REFERENCES lookup_values(id), tenant_id uuid, reference_type varchar(50), reference_id uuid, description text, idempotency_key varchar(120) UNIQUE, initiated_by uuid, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE ledger_entries (id bigserial, txn_id uuid NOT NULL, account_id uuid NOT NULL, tenant_id uuid, amount_minor bigint NOT NULL CHECK (amount_minor <> 0), currency_code char(3) NOT NULL DEFAULT 'INR', balance_after_minor bigint NOT NULL, prev_hash varchar(64), entry_hash varchar(64) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (id, created_at));

-- ---------- auctions
CREATE TABLE auctions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id),
  listing_id uuid NOT NULL UNIQUE REFERENCES listings(id),
  kind varchar(20) NOT NULL DEFAULT 'english_open' CHECK (kind IN ('english_open','sealed','reverse','dutch')),
  start_price_minor bigint NOT NULL CHECK (start_price_minor > 0), reserve_price_minor bigint,
  min_increment_minor bigint NOT NULL DEFAULT 10000, emd_minor bigint NOT NULL DEFAULT 0, emd_pct_bps integer,
  starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, auto_extend_secs integer NOT NULL DEFAULT 120, extend_trigger_secs integer NOT NULL DEFAULT 60,
  min_bidders smallint, requires_seller_approval boolean NOT NULL DEFAULT false, bidder_qualification jsonb NOT NULL DEFAULT '{}',
  status varchar(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','extended','ended','awaiting_approval','settled','cancelled','failed_reserve')),
  winning_bid_id uuid, settled_order_id uuid, version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE bids (   -- APPEND-ONLY (production grants revoke UPDATE/DELETE from kv_app)
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id),
  auction_id uuid NOT NULL REFERENCES auctions(id), bidder_user_id uuid NOT NULL REFERENCES users(id),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0), is_sealed boolean NOT NULL DEFAULT false,
  emd_txn_id uuid, ip inet, device_fingerprint varchar(200), created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX idx_bids_auction ON bids(auction_id, amount_minor DESC);

CREATE TABLE auction_events (
  id uuid NOT NULL DEFAULT uuid_generate_v7(), auction_id uuid NOT NULL, tenant_id uuid NOT NULL,
  event_code varchar(40) NOT NULL, meta jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (id, created_at));

-- RLS: every auction row is tenant-private (auctions are public WITHIN a tenant, isolated across).
ALTER TABLE auctions ENABLE ROW LEVEL SECURITY; ALTER TABLE auctions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON auctions USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
ALTER TABLE bids ENABLE ROW LEVEL SECURITY; ALTER TABLE bids FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON bids USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
ALTER TABLE auction_events ENABLE ROW LEVEL SECURITY; ALTER TABLE auction_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON auction_events USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
ALTER TABLE listings ENABLE ROW LEVEL SECURITY; ALTER TABLE listings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON listings USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
-- NOTE: in production wallet_accounts/ledger_* are EXCLUDED from tenant RLS (stricter kv_wallet regime).

-- seed: currency/unit + the EMD ledger txn type the bid path resolves
INSERT INTO currencies (code, default_name, symbol) VALUES ('INR','Indian Rupee','₹') ON CONFLICT DO NOTHING;
INSERT INTO units (code, default_name, unit_class) VALUES ('quintal','Quintal','mass') ON CONFLICT DO NOTHING;
INSERT INTO lookup_types (code, default_name) VALUES ('ledger_txn_type','Ledger txn type') ON CONFLICT DO NOTHING;
INSERT INTO lookup_values (type_code, tenant_id, code, default_name) VALUES ('ledger_txn_type', NULL, 'emd_hold', 'EMD hold') ON CONFLICT DO NOTHING;
COMMIT;
