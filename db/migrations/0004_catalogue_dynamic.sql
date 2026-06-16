-- ============================================================================
-- MIGRATION 0004 — CATALOGUE DYNAMIC
-- Source of truth: Database_Architecture/full_platform/03_catalogue_dynamic.sql (reproduced verbatim)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it
-- in schema_migrations. NEVER edit an applied migration — add a new numbered one.
-- ============================================================================

-- ============================================================================
-- FILE 03 — DYNAMIC CATALOGUE ENGINE
-- The fix for "varchar category": a 5-level hierarchical category tree
-- (PRD §9.2) + a typed dynamic-attribute system (EAV done right) + a product
-- master that covers crops, livestock supplies, agri-inputs, equipment,
-- dairy products, organic — every sellable thing on the platform.
-- Thousands of crops/products = INSERTs by a catalogue admin, never migrations.
-- ============================================================================

-- ---------- category tree (self-referencing, ltree path, max depth 5)
CREATE TABLE categories (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  parent_id    uuid REFERENCES categories(id),
  code         varchar(80) UNIQUE NOT NULL,           -- 'crops','crops.cereals','crops.cereals.wheat'
  default_name varchar(150) NOT NULL,                 -- display names via translations (L3)
  path         ltree NOT NULL,                        -- 'crops.cereals.wheat'
  depth        smallint NOT NULL CHECK (depth BETWEEN 1 AND 5),
  icon_media_id uuid REFERENCES media_assets(id),
  commerce_kind varchar(30) NOT NULL DEFAULT 'goods', -- goods|livestock|service|rental|course|input_regulated
  requires_license boolean NOT NULL DEFAULT false,    -- pesticide/pharma categories (PRD §9.2 approval rules)
  requires_certificate boolean NOT NULL DEFAULT false,-- organic categories
  min_age      smallint,                              -- 18+ restricted chemicals
  is_active    boolean NOT NULL DEFAULT true,
  sort_order   smallint NOT NULL DEFAULT 100
);
CALL add_std_columns('categories');
CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_path ON categories USING gist(path);

CREATE TABLE tenant_categories (                      -- tenant enables a subset + adds own leaves
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  category_id uuid NOT NULL REFERENCES categories(id),
  is_enabled  boolean NOT NULL DEFAULT true,
  PRIMARY KEY (tenant_id, category_id)
);

-- ---------- dynamic attributes (typed EAV with validation, per PRD §9.2)
CREATE TABLE attribute_definitions (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  code         varchar(80) UNIQUE NOT NULL,           -- 'variety','moisture_pct','grade','harvest_date','breed','hp_rating','fat_pct'
  default_name varchar(150) NOT NULL,
  data_type    varchar(15) NOT NULL CHECK (data_type IN ('text','number','decimal','bool','date','option','multi_option','range','file')),
  unit_code    varchar(20) REFERENCES units(code),    -- moisture_pct → '%'
  validation   jsonb NOT NULL DEFAULT '{}',           -- {min:0,max:100,regex:...}
  is_active    boolean NOT NULL DEFAULT true
);
CALL add_std_columns('attribute_definitions');

CREATE TABLE attribute_options (                      -- dropdown values (variety lists, grades)
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  attribute_id uuid NOT NULL REFERENCES attribute_definitions(id),
  code         varchar(80) NOT NULL,                  -- 'hd2967','lokwan','faq','premium'
  default_name varchar(150) NOT NULL,
  sort_order   smallint NOT NULL DEFAULT 100,
  is_active    boolean NOT NULL DEFAULT true,
  UNIQUE (attribute_id, code)
);
CALL add_std_columns('attribute_options');

CREATE TABLE category_attributes (                    -- which attributes apply to a category branch
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  category_id   uuid NOT NULL REFERENCES categories(id),   -- inherits down the tree
  attribute_id  uuid NOT NULL REFERENCES attribute_definitions(id),
  is_required   boolean NOT NULL DEFAULT false,
  show_in_filters boolean NOT NULL DEFAULT false,     -- auto-generates search facets (PRD §9.2)
  show_on_card  boolean NOT NULL DEFAULT false,
  condition     jsonb,                                -- conditional: {"if":{"organic":true},"then":{"required":["cert_body","cert_no"]}}
  sort_order    smallint NOT NULL DEFAULT 100,
  UNIQUE (category_id, attribute_id)
);
CALL add_std_columns('category_attributes');

-- Attribute templates: clonable per-crop presets (PRD §9.2 'templates')
CREATE TABLE attribute_templates (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  code         varchar(80) UNIQUE NOT NULL,           -- 'wheat_standard','tractor_rental'
  default_name varchar(150) NOT NULL,
  category_id  uuid REFERENCES categories(id),
  payload      jsonb NOT NULL                          -- ordered attr defs + defaults to clone
);
CALL add_std_columns('attribute_templates');

-- ---------- product master ("the thing"), distinct from listings ("the offer")
CREATE TABLE brands (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  default_name varchar(150) NOT NULL,
  manufacturer varchar(200),
  is_verified  boolean NOT NULL DEFAULT false
);
CALL add_std_columns('brands');

CREATE TABLE products (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  category_id   uuid NOT NULL REFERENCES categories(id),
  code          varchar(100) UNIQUE,                  -- SKU-ish for branded goods; NULL for generic produce
  default_name  varchar(200) NOT NULL,
  brand_id      uuid REFERENCES brands(id),
  default_unit  varchar(20) NOT NULL REFERENCES units(code),
  gst_rate_pct  numeric(5,2),
  hsn_code      varchar(12),
  is_perishable boolean NOT NULL DEFAULT false,
  shelf_life_days integer,                            -- perishability SLA driver (PRD §3.2)
  tenant_id     uuid REFERENCES tenants(id),          -- NULL = platform master; set = tenant-private product
  is_active     boolean NOT NULL DEFAULT true,
  search_tsv    tsvector                              -- maintained by app/trigger for fallback search
);
CALL add_std_columns('products');
CREATE INDEX idx_products_category ON products(category_id) WHERE is_active;
CREATE INDEX idx_products_tsv ON products USING gin(search_tsv);
CREATE INDEX idx_products_name_trgm ON products USING gin (default_name gin_trgm_ops);

CREATE TABLE product_attribute_values (               -- typed EAV (L8: descriptive only)
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  product_id    uuid NOT NULL REFERENCES products(id),
  attribute_id  uuid NOT NULL REFERENCES attribute_definitions(id),
  value_text    text,
  value_number  numeric(20,6),
  value_bool    boolean,
  value_date    date,
  option_id     uuid REFERENCES attribute_options(id),
  UNIQUE (product_id, attribute_id)
);
CREATE INDEX idx_pav_product ON product_attribute_values(product_id);
CREATE INDEX idx_pav_attr_option ON product_attribute_values(attribute_id, option_id);
CREATE INDEX idx_pav_attr_number ON product_attribute_values(attribute_id, value_number);

-- ---------- regulated-input compliance (pesticides/pharma — PRD §9.10)
CREATE TABLE regulated_product_rules (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  product_id      uuid REFERENCES products(id),
  category_id     uuid REFERENCES categories(id),     -- rule may apply to whole category
  rule_type       varchar(40) NOT NULL,               -- 'banned_state','prescription_required','license_required','safety_label'
  region_id       uuid REFERENCES admin_regions(id),  -- state-wise restriction lists
  payload         jsonb NOT NULL DEFAULT '{}',
  effective_from  date NOT NULL DEFAULT CURRENT_DATE,
  effective_to    date,
  CHECK (product_id IS NOT NULL OR category_id IS NOT NULL)
);
CALL add_std_columns('regulated_product_rules');
CREATE INDEX idx_rpr_product ON regulated_product_rules(product_id);
CREATE INDEX idx_rpr_category ON regulated_product_rules(category_id);

-- ---------- batches (pharma/inputs expiry tracking, FIFO, recalls — PRD §9.10)
CREATE TABLE product_batches (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  product_id    uuid NOT NULL REFERENCES products(id),
  seller_user_id uuid REFERENCES users(id),           -- store owner
  batch_no      varchar(80) NOT NULL,
  mfg_date      date,
  expiry_date   date,
  mrp_minor     bigint,
  currency_code char(3) NOT NULL DEFAULT 'INR',
  qty_received  numeric(14,3) NOT NULL,
  qty_remaining numeric(14,3) NOT NULL,
  unit_code     varchar(20) NOT NULL REFERENCES units(code),
  is_recalled   boolean NOT NULL DEFAULT false,
  recall_reason text
);
CALL add_std_columns('product_batches');
CREATE INDEX idx_batches_tenant_product ON product_batches(tenant_id, product_id);
CREATE INDEX idx_batches_expiry ON product_batches(expiry_date) WHERE qty_remaining > 0 AND deleted_at IS NULL;

-- ---------- certificates (organic NPOP/PGS, GI, lab reports — PRD §9.11/§26)
CREATE TABLE certificates (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id      uuid REFERENCES tenants(id),
  owner_user_id  uuid REFERENCES users(id),
  cert_type_id   uuid NOT NULL REFERENCES lookup_values(id), -- lookup 'cert_type': npop|pgs_india|usda_organic|gi_tag|lab_report|gap|halal
  cert_no        varchar(100),
  issuing_body   varchar(200),
  subject_type   varchar(50),                         -- 'product','farm','tenant','listing'
  subject_id     uuid,
  media_id       uuid REFERENCES media_assets(id),
  valid_from     date,
  valid_until    date,
  status         kyc_status NOT NULL DEFAULT 'pending',
  blockchain_anchor varchar(120),                     -- Phase 2 hash anchor
  verified_by    uuid REFERENCES users(id)
);
CALL add_std_columns('certificates');
CREATE INDEX idx_certs_owner ON certificates(owner_user_id);
CREATE INDEX idx_certs_expiry ON certificates(valid_until) WHERE status = 'verified';

