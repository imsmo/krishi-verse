-- apps/api/test/sql/reference-slices/reviews_slice.sql · REFERENCE ONLY (not wired into tests).
-- A self-contained, readable overview of the reviews table (db/migrations 0005) + the verified-purchase
-- gate review_eligibility (db/migrations 0024) + their tenant RLS, WITHOUT the full 250-table platform.
-- The actual reviews integration test builds its DB from the REAL db/migrations + db/seeds
-- (test/integration-global-setup.js) — this file is a handy single-file sketch + local sandbox.
--
-- Flow: orders.order_completed → an eligibility row (buyer+seller) is recorded; a party then reviews the
-- counterparty (target resolved from eligibility, never client-supplied). One review per
-- (order, reviewer, target). NO money. Public reads see only status='published'.
BEGIN;
DROP TABLE IF EXISTS reviews, review_eligibility, users, tenants CASCADE;
DROP FUNCTION IF EXISTS current_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS uuid_generate_v7() CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE FUNCTION uuid_generate_v7() RETURNS uuid AS $$ SELECT gen_random_uuid() $$ LANGUAGE sql VOLATILE;
CREATE FUNCTION current_tenant_id() RETURNS uuid AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$ LANGUAGE sql STABLE;

CREATE TABLE tenants (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE users   (id uuid PRIMARY KEY, phone varchar(20) UNIQUE NOT NULL);

-- review_eligibility (0024): the verified-purchase gate — one row per completed order
CREATE TABLE review_eligibility (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id),
  order_id uuid NOT NULL, buyer_user_id uuid NOT NULL REFERENCES users(id), seller_user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid,
  UNIQUE (order_id));
CREATE INDEX idx_review_eligibility_order ON review_eligibility(tenant_id, order_id);

-- reviews (0005): NO version column → mutations lock FOR UPDATE; target is polymorphic (seller|buyer|…)
CREATE TABLE reviews (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id), order_id uuid,
  reviewer_user_id uuid NOT NULL REFERENCES users(id), target_type varchar(30) NOT NULL, target_id uuid NOT NULL,
  stars smallint NOT NULL CHECK (stars BETWEEN 1 AND 5), sub_ratings jsonb NOT NULL DEFAULT '{}', body text,
  tags jsonb NOT NULL DEFAULT '[]', is_verified_purchase boolean NOT NULL DEFAULT false,
  status varchar(20) NOT NULL DEFAULT 'published',   -- published|hidden|under_moderation|removed
  seller_response text, seller_responded_at timestamptz, helpful_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid,
  UNIQUE (order_id, reviewer_user_id, target_type, target_id));
CREATE INDEX idx_reviews_target ON reviews(target_type, target_id) WHERE status='published';

-- RLS: tenant-private (reviews via the 0014 auto-pass; review_eligibility via its own policy in 0024).
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY; ALTER TABLE reviews FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_reviews ON reviews USING (tenant_id IS NULL OR tenant_id = current_tenant_id());
ALTER TABLE review_eligibility ENABLE ROW LEVEL SECURITY; ALTER TABLE review_eligibility FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_review_eligibility ON review_eligibility USING (tenant_id IS NULL OR tenant_id = current_tenant_id());
COMMIT;
