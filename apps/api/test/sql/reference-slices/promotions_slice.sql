-- apps/api/test/sql/reference-slices/promotions_slice.sql · REFERENCE ONLY (not wired into tests).
-- A self-contained, readable overview of the promotions tables (db/migrations 0005: promotions +
-- coupons + coupon_redemptions) + their tenant RLS, WITHOUT the full 250-table platform. The actual
-- promotions integration test builds its DB from the REAL db/migrations + db/seeds — this is a sketch.
--
-- Flow: an admin creates a budgeted promotion (rules jsonb = discount) + coupon codes (global + per-user
-- caps); a buyer redeems a coupon against an order → an APPEND-ONLY redemption (UNIQUE per coupon+order),
-- with uses + spent_minor incremented under row locks (no version column). NO wallet movement (a discount
-- is a price reduction; spent_minor is promo accounting).
BEGIN;
DROP TABLE IF EXISTS coupon_redemptions, coupons, promotions, users, tenants CASCADE;
DROP FUNCTION IF EXISTS current_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS uuid_generate_v7() CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE FUNCTION uuid_generate_v7() RETURNS uuid AS $$ SELECT gen_random_uuid() $$ LANGUAGE sql VOLATILE;
CREATE FUNCTION current_tenant_id() RETURNS uuid AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$ LANGUAGE sql STABLE;

CREATE TABLE tenants (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE users   (id uuid PRIMARY KEY, phone varchar(20) UNIQUE NOT NULL);

CREATE TABLE promotions (   -- NO version column → budget mutations lock FOR UPDATE
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id),
  promo_type varchar(30) NOT NULL, default_name varchar(150) NOT NULL, rules jsonb NOT NULL,
  budget_minor bigint, spent_minor bigint NOT NULL DEFAULT 0, starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

CREATE TABLE coupons (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id),
  promotion_id uuid REFERENCES promotions(id), code varchar(40) NOT NULL,
  max_uses integer, uses integer NOT NULL DEFAULT 0, per_user_limit smallint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid,
  UNIQUE (tenant_id, code));

CREATE TABLE coupon_redemptions (   -- APPEND-ONLY (prod revokes UPDATE/DELETE from kv_app)
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), coupon_id uuid NOT NULL REFERENCES coupons(id), tenant_id uuid NOT NULL REFERENCES tenants(id),
  user_id uuid NOT NULL REFERENCES users(id), order_id uuid, amount_minor bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (coupon_id, order_id));

-- RLS: all tenant-private (the 0014 auto-pass covers them — they predate it).
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY; ALTER TABLE promotions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_promotions ON promotions USING (tenant_id IS NULL OR tenant_id = current_tenant_id());
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY; ALTER TABLE coupons FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_coupons ON coupons USING (tenant_id IS NULL OR tenant_id = current_tenant_id());
ALTER TABLE coupon_redemptions ENABLE ROW LEVEL SECURITY; ALTER TABLE coupon_redemptions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_coupon_redemptions ON coupon_redemptions USING (tenant_id IS NULL OR tenant_id = current_tenant_id());
COMMIT;
