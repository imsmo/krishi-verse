-- apps/api/test/sql/reference-slices/warehousing_slice.sql · REFERENCE ONLY (not wired into tests).
-- A self-contained sketch of the warehousing receipt spine (db/migrations/0010) — warehouses,
-- storage_bookings, assay_reports, nwr_receipts — plus tenant RLS, WITHOUT the full platform. The real
-- integration test builds its DB from the REAL db/migrations + db/seeds; this is a map.
--
-- Flow: an operator lists a warehouse (rate/qtl/month); a depositor books storage; operator confirms →
-- stores → assays → issues an eNWR (depositor = holder). At release the storage fee (qty × rate × months,
-- float-free) is collected depositor → operator. warehouses.tenant_id may be NULL (platform-global /
-- independent WDRA, cross-tenant visible). No version columns → mutations lock FOR UPDATE.
BEGIN;
DROP TABLE IF EXISTS nwr_receipts, assay_reports, storage_bookings, warehouses, products, units, users, tenants CASCADE;
DROP FUNCTION IF EXISTS current_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS uuid_generate_v7() CASCADE;
DROP TYPE IF EXISTS nwr_status CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE FUNCTION uuid_generate_v7() RETURNS uuid AS $$ SELECT gen_random_uuid() $$ LANGUAGE sql VOLATILE;
CREATE FUNCTION current_tenant_id() RETURNS uuid AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$ LANGUAGE sql STABLE;
CREATE TYPE nwr_status AS ENUM ('issued','pledged','partially_released','released','cancelled','defaulted');

CREATE TABLE tenants (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE users   (id uuid PRIMARY KEY, phone varchar(20) UNIQUE NOT NULL);
CREATE TABLE units   (code varchar(20) PRIMARY KEY);
CREATE TABLE products(id uuid PRIMARY KEY);

CREATE TABLE warehouses (  -- tenant_id NULL = platform-global / independent WDRA (cross-tenant visible)
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid REFERENCES tenants(id), operator_user_id uuid REFERENCES users(id),
  default_name varchar(200) NOT NULL, wdra_reg_no varchar(60), address_id uuid, capacity_mt numeric(12,2), storage_kinds jsonb NOT NULL DEFAULT '[]',
  commodities_accepted jsonb NOT NULL DEFAULT '[]', rate_per_qtl_month_minor bigint, insurance_policy_ref varchar(120), is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

CREATE TABLE storage_bookings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id), warehouse_id uuid NOT NULL REFERENCES warehouses(id),
  depositor_user_id uuid NOT NULL REFERENCES users(id), product_id uuid NOT NULL REFERENCES products(id), quantity numeric(12,3) NOT NULL,
  unit_code varchar(20) NOT NULL REFERENCES units(code), expected_arrival date, status varchar(20) NOT NULL DEFAULT 'requested', stored_at timestamptz, released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

CREATE TABLE assay_reports (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id), storage_booking_id uuid NOT NULL REFERENCES storage_bookings(id),
  assayer_name varchar(200) NOT NULL, parameters jsonb NOT NULL, grade_option_id uuid, report_media_id uuid, assayed_at timestamptz NOT NULL, valid_until date,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

CREATE TABLE nwr_receipts (  -- electronic Negotiable Warehouse Receipt; valuation_minor is bigint minor units
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id), storage_booking_id uuid NOT NULL REFERENCES storage_bookings(id),
  repository varchar(20) NOT NULL, enwr_no varchar(60) UNIQUE NOT NULL, holder_user_id uuid NOT NULL REFERENCES users(id), quantity numeric(12,3) NOT NULL,
  valuation_minor bigint NOT NULL, status nwr_status NOT NULL DEFAULT 'issued', pledged_loan_id uuid, issued_at timestamptz NOT NULL, expires_at date,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

-- RLS: tenant-private rows + platform-global (NULL tenant) visible to all (matches the 0014 auto policy).
ALTER TABLE warehouses       ENABLE ROW LEVEL SECURITY; ALTER TABLE warehouses       FORCE ROW LEVEL SECURITY;
ALTER TABLE storage_bookings ENABLE ROW LEVEL SECURITY; ALTER TABLE storage_bookings FORCE ROW LEVEL SECURITY;
ALTER TABLE assay_reports    ENABLE ROW LEVEL SECURITY; ALTER TABLE assay_reports    FORCE ROW LEVEL SECURITY;
ALTER TABLE nwr_receipts     ENABLE ROW LEVEL SECURITY; ALTER TABLE nwr_receipts     FORCE ROW LEVEL SECURITY;
CREATE POLICY t_iso_wh   ON warehouses       USING (tenant_id IS NULL OR tenant_id = current_tenant_id());
CREATE POLICY t_iso_sb   ON storage_bookings USING (tenant_id = current_tenant_id());
CREATE POLICY t_iso_ar   ON assay_reports    USING (tenant_id = current_tenant_id());
CREATE POLICY t_iso_nwr  ON nwr_receipts     USING (tenant_id = current_tenant_id());
COMMIT;
