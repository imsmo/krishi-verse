-- apps/api/test/sql/reference-slices/cms_slice.sql · REFERENCE ONLY (not wired into tests).
-- A self-contained sketch of the CMS spine (db/migrations/0012) — cms_pages + banners — plus tenant RLS. The
-- real integration test builds its DB from the REAL db/migrations + db/seeds.
--
-- Flow: an editor authors a page (draft, version N per slug) → publishes it (the prior published version of the
-- slug is archived → exactly one live) → the public reads the latest published version by slug. Banners run in a
-- [starts,ends) window at a placement, with atomic click tracking; an expiry job deactivates ended banners.
-- cms_pages may be platform-global (tenant_id NULL); banners are tenant-scoped.
BEGIN;
DROP TABLE IF EXISTS banners, cms_pages, media_assets, languages, users, tenants CASCADE;
DROP FUNCTION IF EXISTS current_tenant_id() CASCADE; DROP FUNCTION IF EXISTS uuid_generate_v7() CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE FUNCTION uuid_generate_v7() RETURNS uuid AS $$ SELECT gen_random_uuid() $$ LANGUAGE sql VOLATILE;
CREATE FUNCTION current_tenant_id() RETURNS uuid AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$ LANGUAGE sql STABLE;

CREATE TABLE tenants (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE users   (id uuid PRIMARY KEY, phone varchar(20) UNIQUE NOT NULL);
CREATE TABLE languages (code varchar(8) PRIMARY KEY, name_english varchar(60));
CREATE TABLE media_assets (id uuid PRIMARY KEY DEFAULT uuid_generate_v7());

CREATE TABLE cms_pages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid REFERENCES tenants(id), slug varchar(150) NOT NULL,
  page_kind varchar(30) NOT NULL DEFAULT 'static', default_title varchar(250) NOT NULL, body text NOT NULL, version integer NOT NULL DEFAULT 1,
  status varchar(15) NOT NULL DEFAULT 'draft', published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid,
  UNIQUE (tenant_id, slug, version));

CREATE TABLE banners (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id), placement varchar(40) NOT NULL, media_id uuid NOT NULL REFERENCES media_assets(id),
  language_code varchar(8) REFERENCES languages(code), target_url varchar(400), audience_rules jsonb NOT NULL DEFAULT '{}',
  starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, click_count integer NOT NULL DEFAULT 0, is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);
CREATE INDEX idx_banners_active ON banners(tenant_id, placement) WHERE is_active;

-- RLS: banners private to their tenant; cms_pages allow NULL (platform pages, visible to all; not writable here, Law 11).
ALTER TABLE cms_pages ENABLE ROW LEVEL SECURITY; ALTER TABLE cms_pages FORCE ROW LEVEL SECURITY;
ALTER TABLE banners   ENABLE ROW LEVEL SECURITY; ALTER TABLE banners   FORCE ROW LEVEL SECURITY;
CREATE POLICY t_iso_page   ON cms_pages USING (tenant_id IS NULL OR tenant_id = current_tenant_id());
CREATE POLICY t_iso_banner ON banners   USING (tenant_id = current_tenant_id());
COMMIT;
