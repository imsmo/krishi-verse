-- ============================================================================
-- MIGRATION 0001 — FOUNDATION
-- Source of truth: Database_Architecture/full_platform/00_foundation.sql (reproduced verbatim)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it
-- in schema_migrations. NEVER edit an applied migration — add a new numbered one.
-- ============================================================================

-- ============================================================================
-- KRISHI-VERSE FULL-PLATFORM SCHEMA · FILE 00 — FOUNDATION (GLOBAL MASTER DATA)
-- ============================================================================
-- PostgreSQL 15+ / Aurora. Run files in numeric order 00 → 13.
--
-- DESIGN LAWS FOR THE ENTIRE SCHEMA (every file obeys these):
--  L1  DYNAMIC MASTER DATA: anything an admin should manage (languages,
--      categories, attributes, roles, skills, units, charge rules, templates,
--      schemes...) is a TABLE, never a hardcoded column or enum.
--  L2  ENUMS ONLY FOR STATE MACHINES: order/loan/claim statuses are enums on
--      purpose — state transitions are code-governed safety logic, not config.
--  L3  NO LANGUAGE-SPECIFIC COLUMNS ANYWHERE: all display text goes through
--      the translations system in this file. Adding language #13 = 1 INSERT.
--  L4  MULTI-CURRENCY FROM DAY 1: money = BIGINT minor units + currency_code.
--  L5  tenant_id on every tenant-scoped table; RLS auto-applied in file 13.
--  L6  uuid_generate_v7() PKs; created_at/updated_at/deleted_at everywhere.
--  L7  Hot/billion-row tables are RANGE-partitioned by month (daily for milk).
--  L8  EAV (dynamic attributes) is used for DESCRIPTIVE data only — never for
--      money, status, or relationships. Those are real columns. This is the
--      line between "dynamic" and "unqueryable mush"; production systems
--      (Amazon, Shopify) draw it exactly here.
-- ============================================================================


CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS ltree;          -- materialised category paths

-- ---------- helpers ----------------------------------------------------------
CREATE OR REPLACE FUNCTION uuid_generate_v7() RETURNS uuid AS $$
SELECT encode(set_bit(set_bit(
  overlay(uuid_send(gen_random_uuid())
          placing substring(int8send((extract(epoch from clock_timestamp())*1000)::bigint) from 3)
          from 1 for 6), 52, 1), 53, 1), 'hex')::uuid;
$$ LANGUAGE sql VOLATILE;

CREATE OR REPLACE FUNCTION trg_set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

-- Extract the embedded timestamp from a UUIDv7. CRITICAL AT SCALE: partitioned
-- tables have PK (id, created_at); when the app has only the id, this derives
-- created_at so PostgreSQL prunes to ONE partition instead of scanning 120.
-- Usage: WHERE id = $1 AND created_at >= uuid_v7_time($1) - interval '1 second'
--                       AND created_at <  uuid_v7_time($1) + interval '1 second'
CREATE OR REPLACE FUNCTION uuid_v7_time(u uuid) RETURNS timestamptz AS $$
SELECT to_timestamp((('x' || substring(replace(u::text,'-','') from 1 for 12))::bit(48)::bigint) / 1000.0);
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid AS $$
SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid; $$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION current_user_id() RETURNS uuid AS $$
SELECT NULLIF(current_setting('app.user_id', true), '')::uuid; $$ LANGUAGE sql STABLE;

-- Attach standard audit columns + updated_at trigger to a table (DRY utility
-- used by every file; keeps 200+ tables consistent without copy-paste errors).
CREATE OR REPLACE PROCEDURE add_std_columns(p_table text) AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I
    ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
    ADD COLUMN IF NOT EXISTS created_by uuid,
    ADD COLUMN IF NOT EXISTS updated_by uuid', p_table);
  EXECUTE format('CREATE TRIGGER %I_uat BEFORE UPDATE ON %I
                  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at()', p_table, p_table);
END; $$ LANGUAGE plpgsql;

-- ============================================================================
-- 0.1 LANGUAGES — fully dynamic. Launch with 3 rows; Marathi = INSERT, no deploy.
-- ============================================================================
CREATE TABLE languages (
  code            varchar(8)  PRIMARY KEY,            -- BCP-47: 'hi','en','gu','mr','bn-IN'
  name_native     varchar(80) NOT NULL,               -- 'हिन्दी'
  name_english    varchar(80) NOT NULL,               -- 'Hindi'
  script          varchar(30) NOT NULL,               -- 'Devanagari','Gujarati','Latin'
  direction       varchar(3)  NOT NULL DEFAULT 'ltr' CHECK (direction IN ('ltr','rtl')),
  font_stack      varchar(200),                       -- 'Noto Sans Devanagari'
  number_format   varchar(20) NOT NULL DEFAULT 'indian',  -- lakh/crore grouping
  is_active       boolean NOT NULL DEFAULT false,
  voice_stt_ready boolean NOT NULL DEFAULT false,     -- voice listing supported?
  sort_order      smallint NOT NULL DEFAULT 100
);
CALL add_std_columns('languages');

-- Tenant chooses which active languages it offers (plan caps enforced in app)
CREATE TABLE tenant_languages (
  tenant_id     uuid NOT NULL,                        -- FK added in file 01
  language_code varchar(8) NOT NULL REFERENCES languages(code),
  is_default    boolean NOT NULL DEFAULT false,
  PRIMARY KEY (tenant_id, language_code)
);

-- ============================================================================
-- 0.2 TRANSLATIONS — one polymorphic store for ALL translatable master data.
-- Pattern: entity tables hold a language-neutral default_name; every display
-- string in every language lives here. One GIN-friendly shape, one cache, one
-- admin "translation queue" UI, one AI-translate pipeline (PRD §14.3, §9.14).
-- ============================================================================
CREATE TABLE translations (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  entity_type   varchar(60)  NOT NULL,                -- 'category','crop','attribute','scheme','course',...
  entity_id     uuid         NOT NULL,
  field         varchar(60)  NOT NULL,                -- 'name','description','benefit_text',...
  language_code varchar(8)   NOT NULL REFERENCES languages(code),
  text          text         NOT NULL,
  is_machine    boolean NOT NULL DEFAULT false,       -- AI-translated, pending human review
  reviewed_by   uuid,
  UNIQUE (entity_type, entity_id, field, language_code)
);
CALL add_std_columns('translations');
CREATE INDEX idx_translations_entity ON translations(entity_type, entity_id);
CREATE INDEX idx_translations_lang   ON translations(language_code);

-- UI strings (app labels, button text) — keyed catalog, same dynamic principle
CREATE TABLE ui_messages (
  key           varchar(200) NOT NULL,                -- 'listing.create.title'
  language_code varchar(8)   NOT NULL REFERENCES languages(code),
  text          text NOT NULL,
  PRIMARY KEY (key, language_code)
);

-- ============================================================================
-- 0.3 GEOGRAPHY — full dynamic hierarchy (international-ready: PRD Phase 4/5)
-- ============================================================================
CREATE TABLE countries (
  code          char(2) PRIMARY KEY,                  -- ISO-3166: 'IN','BD','LK'
  default_name  varchar(100) NOT NULL,
  currency_code char(3) NOT NULL,
  phone_prefix  varchar(6) NOT NULL,                  -- '+91'
  timezone      varchar(40) NOT NULL DEFAULT 'Asia/Kolkata',
  is_active     boolean NOT NULL DEFAULT false
);
CALL add_std_columns('countries');

CREATE TABLE admin_regions (                          -- states → districts → talukas → villages, any depth
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  country_code  char(2) NOT NULL REFERENCES countries(code),
  parent_id     uuid REFERENCES admin_regions(id),
  level         smallint NOT NULL,                    -- 1=state 2=district 3=taluka 4=village
  code          varchar(20),                          -- LGD code (govt Local Government Directory)
  default_name  varchar(150) NOT NULL,                -- translations via translations table
  path          ltree NOT NULL,                       -- 'in.gj.junagadh.vanthali.vadal'
  centroid_lat  numeric(9,6),
  centroid_lng  numeric(9,6),
  is_active     boolean NOT NULL DEFAULT true
);
CALL add_std_columns('admin_regions');
CREATE INDEX idx_regions_parent ON admin_regions(parent_id);
CREATE INDEX idx_regions_path   ON admin_regions USING gist(path);
CREATE INDEX idx_regions_level  ON admin_regions(country_code, level);
CREATE UNIQUE INDEX uq_regions_lgd ON admin_regions(country_code, code) WHERE code IS NOT NULL;

CREATE TABLE pincodes (
  pincode      varchar(10) NOT NULL,
  country_code char(2) NOT NULL REFERENCES countries(code),
  region_id    uuid REFERENCES admin_regions(id),     -- deepest known region
  lat          numeric(9,6),
  lng          numeric(9,6),
  PRIMARY KEY (country_code, pincode)
);
CREATE INDEX idx_pincodes_region ON pincodes(region_id);

-- ============================================================================
-- 0.4 CURRENCIES & FX
-- ============================================================================
CREATE TABLE currencies (
  code          char(3) PRIMARY KEY,                  -- 'INR','BDT','AED'
  default_name  varchar(60) NOT NULL,
  symbol        varchar(8)  NOT NULL,
  minor_units   smallint NOT NULL DEFAULT 2,          -- INR: 100 paise
  is_active     boolean NOT NULL DEFAULT false
);
CALL add_std_columns('currencies');

CREATE TABLE fx_rates (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  base_code     char(3) NOT NULL REFERENCES currencies(code),
  quote_code    char(3) NOT NULL REFERENCES currencies(code),
  rate          numeric(18,8) NOT NULL,
  as_of         date NOT NULL,
  source        varchar(50) NOT NULL,
  UNIQUE (base_code, quote_code, as_of)
);

-- ============================================================================
-- 0.5 UNITS OF MEASURE — dynamic, with conversions (kg↔quintal↔ton, L, acre…)
-- ============================================================================
CREATE TABLE units (
  code          varchar(20) PRIMARY KEY,              -- 'kg','quintal','ton','litre','piece','acre','hour'
  default_name  varchar(60) NOT NULL,
  unit_class    varchar(20) NOT NULL,                 -- 'mass','volume','count','area','time','length'
  is_active     boolean NOT NULL DEFAULT true
);
CALL add_std_columns('units');

CREATE TABLE unit_conversions (
  from_unit varchar(20) NOT NULL REFERENCES units(code),
  to_unit   varchar(20) NOT NULL REFERENCES units(code),
  factor    numeric(20,10) NOT NULL,                  -- 1 quintal = 100 kg
  PRIMARY KEY (from_unit, to_unit)
);

-- ============================================================================
-- 0.6 MEDIA — every photo/video/voice/doc in the platform registers here once;
-- domain tables link via media_links. One virus-scan, one CDN, one EXIF-strip,
-- one duplicate-detector (PRD §9.3 media handling) instead of per-table jsonb.
-- ============================================================================
CREATE TABLE media_assets (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id     uuid,                                 -- NULL = platform asset
  uploader_user_id uuid,
  kind          varchar(20) NOT NULL CHECK (kind IN ('image','video','audio','document')),
  s3_key        varchar(500) NOT NULL UNIQUE,
  thumb_s3_key  varchar(500),
  mime_type     varchar(100) NOT NULL,
  bytes         bigint NOT NULL,
  width         integer,
  height        integer,
  duration_secs integer,
  sha256        varchar(64) NOT NULL,                 -- duplicate detection
  scan_status   varchar(20) NOT NULL DEFAULT 'pending' CHECK (scan_status IN ('pending','clean','infected','failed')),
  exif_stripped boolean NOT NULL DEFAULT false
);
CALL add_std_columns('media_assets');
CREATE INDEX idx_media_sha ON media_assets(sha256);
CREATE INDEX idx_media_tenant ON media_assets(tenant_id);

CREATE TABLE media_links (                            -- polymorphic attach, ordered
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  media_id    uuid NOT NULL REFERENCES media_assets(id),
  entity_type varchar(60) NOT NULL,                   -- 'listing','animal','kyc_document',...
  entity_id   uuid NOT NULL,
  purpose     varchar(40) NOT NULL DEFAULT 'gallery', -- 'gallery','cover','proof_of_delivery','udder_photo'
  sort_order  smallint NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_media_links_entity ON media_links(entity_type, entity_id);

-- ============================================================================
-- 0.7 GENERIC LOOKUPS — admin-manageable controlled vocabularies that don't
-- deserve their own table (dispute reasons, cancel reasons, doc types, task
-- types, report categories...). Display text via translations (L3).
-- ============================================================================
CREATE TABLE lookup_types (
  code         varchar(60) PRIMARY KEY,               -- 'cancel_reason','dispute_reason','doc_type','labour_task'
  default_name varchar(100) NOT NULL,
  is_tenant_extendable boolean NOT NULL DEFAULT false -- may tenants add their own values?
);
CREATE TABLE lookup_values (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  type_code    varchar(60) NOT NULL REFERENCES lookup_types(code),
  tenant_id    uuid,                                  -- NULL = platform value; set = tenant's own value
  code         varchar(80) NOT NULL,
  default_name varchar(150) NOT NULL,
  meta         jsonb NOT NULL DEFAULT '{}',
  sort_order   smallint NOT NULL DEFAULT 100,
  is_active    boolean NOT NULL DEFAULT true,
  UNIQUE (type_code, tenant_id, code)
);
CALL add_std_columns('lookup_values');
CREATE INDEX idx_lookup_values_type ON lookup_values(type_code) WHERE is_active;

-- ============================================================================
-- 0.8 SEQUENTIAL HUMAN-FACING NUMBERS (order no, invoice no) — per tenant,
-- per doc-type, gapless-enough, prefix-configurable. PKs stay UUID (L6);
-- humans get KV-ORD-2026-000123.
-- ============================================================================
CREATE TABLE doc_number_series (
  tenant_id  uuid NOT NULL,
  doc_type   varchar(30) NOT NULL,                    -- 'order','invoice','settlement','booking'
  prefix     varchar(20) NOT NULL,
  period     varchar(10) NOT NULL,                    -- '2026' or '2026-04' (FY resets)
  last_value bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, doc_type, period)
);

CREATE OR REPLACE FUNCTION next_doc_number(p_tenant uuid, p_type varchar, p_prefix varchar, p_period varchar)
RETURNS varchar AS $$
DECLARE v bigint;
BEGIN
  INSERT INTO doc_number_series(tenant_id, doc_type, prefix, period, last_value)
  VALUES (p_tenant, p_type, p_prefix, p_period, 1)
  ON CONFLICT (tenant_id, doc_type, period)
  DO UPDATE SET last_value = doc_number_series.last_value + 1
  RETURNING last_value INTO v;
  RETURN p_prefix || '-' || p_period || '-' || lpad(v::text, 6, '0');
END; $$ LANGUAGE plpgsql;

