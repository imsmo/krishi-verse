-- apps/api/test/sql/identity_slice.sql · self-contained schema for the identity integration
-- test (auth + RBAC + RLS). Mirrors db/migrations 0003 (+ helpers/outbox/audit) without the
-- 250-table platform. RLS on user_tenant_roles proves real cross-tenant isolation. Idempotent.
BEGIN;
DROP TABLE IF EXISTS consents, consent_purposes, login_events, sessions, devices,
  staff_permission_overrides, user_tenant_roles, role_permissions, permissions, roles,
  kyc_documents, audit_log, outbox_events, users, tenants CASCADE;
DROP FUNCTION IF EXISTS current_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS current_user_id() CASCADE;
DROP FUNCTION IF EXISTS uuid_generate_v7() CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE FUNCTION uuid_generate_v7() RETURNS uuid AS $$ SELECT gen_random_uuid() $$ LANGUAGE sql VOLATILE;
CREATE FUNCTION current_tenant_id() RETURNS uuid AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$ LANGUAGE sql STABLE;
CREATE FUNCTION current_user_id() RETURNS uuid AS $$ SELECT NULLIF(current_setting('app.user_id', true), '')::uuid $$ LANGUAGE sql STABLE;

CREATE TABLE tenants (id uuid PRIMARY KEY, name text NOT NULL);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), phone varchar(20) UNIQUE NOT NULL, phone_verified_at timestamptz,
  full_name varchar(200), gender varchar(15), dob date, language_code varchar(8) NOT NULL DEFAULT 'hi',
  country_code char(2) NOT NULL DEFAULT 'IN', email varchar(200), email_verified_at timestamptz, photo_media_id uuid,
  status varchar(20) NOT NULL DEFAULT 'active', aadhaar_last4 varchar(4), aadhaar_vault_ref varchar(200),
  pan_vault_ref varchar(200), is_test boolean NOT NULL DEFAULT false, last_active_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
  created_by uuid, updated_by uuid);

CREATE TABLE roles (id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), code varchar(50) UNIQUE NOT NULL, default_name varchar(100) NOT NULL,
  scope varchar(10) NOT NULL DEFAULT 'tenant', requires_kyc boolean NOT NULL DEFAULT false, requires_approval boolean NOT NULL DEFAULT false,
  module_code varchar(10), is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);
CREATE TABLE permissions (code varchar(80) PRIMARY KEY, default_name varchar(150) NOT NULL, module_code varchar(10));
CREATE TABLE role_permissions (role_id uuid NOT NULL REFERENCES roles(id), permission_code varchar(80) NOT NULL REFERENCES permissions(code), PRIMARY KEY (role_id, permission_code));

CREATE TABLE user_tenant_roles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), user_id uuid NOT NULL REFERENCES users(id), tenant_id uuid NOT NULL REFERENCES tenants(id),
  role_id uuid NOT NULL REFERENCES roles(id), kyc_status varchar(15) NOT NULL DEFAULT 'none', is_active boolean NOT NULL DEFAULT true,
  role_data jsonb NOT NULL DEFAULT '{}', approved_by uuid, approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid,
  UNIQUE (user_id, tenant_id, role_id));
CREATE TABLE staff_permission_overrides (user_tenant_role_id uuid NOT NULL REFERENCES user_tenant_roles(id), permission_code varchar(80) NOT NULL REFERENCES permissions(code), is_granted boolean NOT NULL, PRIMARY KEY (user_tenant_role_id, permission_code));

CREATE TABLE kyc_documents (id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid, user_id uuid NOT NULL REFERENCES users(id),
  role_id uuid, doc_type_id uuid NOT NULL, media_id uuid NOT NULL, doc_no_masked varchar(50), issued_by varchar(150), valid_from date, valid_until date,
  status varchar(15) NOT NULL DEFAULT 'pending', verify_method varchar(30), reviewed_by uuid, reviewed_at timestamptz, reject_reason text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

CREATE TABLE devices (id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), user_id uuid NOT NULL REFERENCES users(id), fingerprint varchar(200) NOT NULL,
  platform varchar(20), model varchar(100), os_version varchar(40), app_version varchar(20), push_token varchar(300), last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid, UNIQUE (user_id, fingerprint));
CREATE TABLE sessions (id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), user_id uuid NOT NULL REFERENCES users(id), device_id uuid REFERENCES devices(id),
  refresh_token_hash varchar(128) NOT NULL, ip inet, expires_at timestamptz NOT NULL, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE login_events (id uuid NOT NULL DEFAULT uuid_generate_v7(), user_id uuid, phone varchar(20), succeeded boolean NOT NULL, method varchar(20) NOT NULL, ip inet, device_fingerprint varchar(200), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (id, created_at));

CREATE TABLE consent_purposes (code varchar(60) PRIMARY KEY, default_name varchar(150) NOT NULL, is_mandatory boolean NOT NULL DEFAULT false, current_version varchar(20) NOT NULL DEFAULT 'v1');
CREATE TABLE consents (id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), user_id uuid NOT NULL REFERENCES users(id), purpose_code varchar(60) NOT NULL REFERENCES consent_purposes(code), version varchar(20) NOT NULL, granted boolean NOT NULL, channel varchar(30) NOT NULL, assisted_by uuid, created_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE outbox_events (id bigserial PRIMARY KEY, tenant_id uuid, aggregate_type varchar(60) NOT NULL, aggregate_id uuid NOT NULL, event_type varchar(120) NOT NULL, payload jsonb NOT NULL, status varchar(15) NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz);
CREATE TABLE audit_log (id bigserial, tenant_id uuid, actor_user_id uuid, actor_role varchar(40), action varchar(120) NOT NULL, entity_type varchar(60), entity_id uuid, old_value jsonb, new_value jsonb, reason text, ip inet, user_agent varchar(300), request_id varchar(60), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (id, created_at));

-- RLS: prove tenant isolation on the tenant-scoped membership table.
ALTER TABLE user_tenant_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tenant_roles FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON user_tenant_roles USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());

-- seed: roles + permissions + grants (subset of db/seeds 0004) + a test tenant + consent purpose
INSERT INTO roles (code, default_name, scope, requires_approval) VALUES
  ('farmer','Farmer','tenant',false), ('tenant_admin','Tenant Admin','tenant',true) ON CONFLICT DO NOTHING;
INSERT INTO permissions (code, default_name) VALUES
  ('listing.create','Create listing'), ('user.approve','Approve users') ON CONFLICT DO NOTHING;
INSERT INTO role_permissions (role_id, permission_code)
  SELECT r.id, 'listing.create' FROM roles r WHERE r.code='farmer'
  UNION SELECT r.id, 'user.approve' FROM roles r WHERE r.code='tenant_admin' ON CONFLICT DO NOTHING;
INSERT INTO consent_purposes (code, default_name, current_version) VALUES ('marketing','Marketing','v2') ON CONFLICT DO NOTHING;
COMMIT;
