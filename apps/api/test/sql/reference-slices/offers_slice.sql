-- apps/api/test/sql/reference-slices/offers_slice.sql · REFERENCE ONLY (not wired into tests).
-- A self-contained, readable overview of the listing_offers table (db/migrations 0015) + its tenant
-- RLS (backfilled by migration 0020), WITHOUT the full 250-table platform. The actual offers
-- integration test builds its DB from the REAL db/migrations + db/seeds
-- (test/integration-global-setup.js) — this file is a handy single-file sketch + local sandbox.
--
-- Shows the negotiation row: a buyer's offered_price vs the seller's counter_price, a `round` that
-- flips the turn (odd → seller's turn, even → buyer's turn), the status machine
-- (open|countered|accepted|rejected|expired|converted), and converted_order_id for the downstream
-- order. NO money moves here — an accepted offer is announced via the outbox; orders does the rest.
BEGIN;
DROP TABLE IF EXISTS listing_offers, listings, users, tenants CASCADE;
DROP FUNCTION IF EXISTS current_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS uuid_generate_v7() CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE FUNCTION uuid_generate_v7() RETURNS uuid AS $$ SELECT gen_random_uuid() $$ LANGUAGE sql VOLATILE;
CREATE FUNCTION current_tenant_id() RETURNS uuid AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$ LANGUAGE sql STABLE;

CREATE TABLE tenants (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE users   (id uuid PRIMARY KEY, phone varchar(20) UNIQUE NOT NULL);

-- listings: only the columns ListingService.getById reads (offers reference the listing + its seller)
CREATE TABLE listings (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), seller_user_id uuid NOT NULL,
  title varchar(250) NOT NULL, quantity_available numeric(14,3) NOT NULL, min_order_qty numeric(14,3) NOT NULL DEFAULT 1,
  price_minor bigint NOT NULL, status varchar(15) NOT NULL DEFAULT 'published', version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz);

-- ---------- listing_offers (NO version column — add_std_columns only adds created/updated/deleted_at;
-- mutations lock the row FOR UPDATE inside the tx instead of using an optimistic version)
CREATE TABLE listing_offers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id),
  listing_id uuid NOT NULL REFERENCES listings(id), buyer_user_id uuid NOT NULL REFERENCES users(id),
  quantity numeric(14,3) NOT NULL,
  offered_price_minor bigint NOT NULL,            -- buyer's per-unit offer
  counter_price_minor bigint,                     -- seller's per-unit counter
  round smallint NOT NULL DEFAULT 1,              -- odd ⇒ seller's turn, even ⇒ buyer's turn
  status varchar(20) NOT NULL DEFAULT 'open',     -- open|countered|accepted|rejected|expired|converted
  expires_at timestamptz NOT NULL,
  converted_order_id uuid,                        -- set downstream by orders on conversion
  ai_suggested jsonb,                             -- reserved for an AI fair-price band (unused here)
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
  created_by uuid, updated_by uuid);
CREATE INDEX idx_offers_listing ON listing_offers(listing_id) WHERE status IN ('open','countered');
CREATE INDEX idx_offers_buyer   ON listing_offers(buyer_user_id, created_at DESC);

-- RLS: listing_offers is tenant-private (backfilled by migration 0020 — the 0014 auto-pass predated
-- this table). NULL tenant_id would be platform-global, but offers always carry a tenant.
ALTER TABLE listing_offers ENABLE ROW LEVEL SECURITY; ALTER TABLE listing_offers FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_listing_offers ON listing_offers USING (tenant_id IS NULL OR tenant_id = current_tenant_id());
ALTER TABLE listings ENABLE ROW LEVEL SECURITY; ALTER TABLE listings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON listings USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
COMMIT;
