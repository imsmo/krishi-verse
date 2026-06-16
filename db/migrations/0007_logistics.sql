-- ============================================================================
-- MIGRATION 0007 — LOGISTICS
-- Source of truth: Database_Architecture/full_platform/06_logistics.sql (reproduced verbatim)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it
-- in schema_migrations. NEVER edit an applied migration — add a new numbered one.
-- ============================================================================

-- ============================================================================
-- FILE 06 — LOGISTICS: ZONES, PARTNERS, SHIPMENTS, SLOTS, ROUTES, COLD CHAIN
-- Module M07 + PRD §9.7 (incl. Saturday Village Run signature + reefer logs)
-- ============================================================================

CREATE TYPE shipment_status AS ENUM ('pending','assigned','pickup_scheduled','picked_up','in_transit','at_hub','out_for_delivery','delivered','failed','returned','cancelled');

CREATE TABLE delivery_zones (                         -- tenant serviceability + charge zoning
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  default_name varchar(120) NOT NULL,
  pincodes    jsonb NOT NULL DEFAULT '[]',
  region_ids  jsonb NOT NULL DEFAULT '[]',
  charge_definition_id uuid REFERENCES charge_definitions(id),
  is_active   boolean NOT NULL DEFAULT true
);
CALL add_std_columns('delivery_zones');

CREATE TABLE logistics_partners (                     -- 3PLs + tenant fleets + individual riders
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id    uuid REFERENCES tenants(id),           -- NULL = platform-level 3PL (Delhivery, Shadowfax)
  partner_kind varchar(20) NOT NULL CHECK (partner_kind IN ('3pl','tenant_fleet','rider')),
  provider_code varchar(60) REFERENCES integration_providers(code),
  default_name varchar(150) NOT NULL,
  rider_user_id uuid REFERENCES users(id),            -- delivery-partner role user
  supports_cold_chain boolean NOT NULL DEFAULT false,
  is_active    boolean NOT NULL DEFAULT true
);
CALL add_std_columns('logistics_partners');

CREATE TABLE vehicles (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id   uuid REFERENCES tenants(id),
  partner_id  uuid NOT NULL REFERENCES logistics_partners(id),
  reg_no      varchar(20) NOT NULL,
  vehicle_type_id uuid REFERENCES lookup_values(id),  -- lookup 'vehicle_type': bike|tempo|truck|reefer_7mt|tractor_trolley
  capacity_kg numeric(10,2),
  is_refrigerated boolean NOT NULL DEFAULT false,
  rc_doc_id   uuid REFERENCES kyc_documents(id),
  UNIQUE (partner_id, reg_no)
);
CALL add_std_columns('vehicles');

CREATE TABLE pickup_slots (                           -- seller-offered windows (PRD pickup flow)
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id),
  seller_user_id uuid NOT NULL REFERENCES users(id),
  weekday    smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time   time NOT NULL,
  is_active  boolean NOT NULL DEFAULT true
);
CALL add_std_columns('pickup_slots');

CREATE TABLE shipments (
  id             uuid NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id      uuid NOT NULL,
  order_id       uuid NOT NULL,
  partner_id     uuid,
  vehicle_id     uuid,
  rider_user_id  uuid,
  status         shipment_status NOT NULL DEFAULT 'pending',
  awb_no         varchar(60),                         -- 3PL tracking number
  pickup_address_id uuid,
  drop_address_id   uuid,
  scheduled_pickup_at timestamptz,
  scheduled_window_mins integer,
  picked_up_at   timestamptz,
  delivered_at   timestamptz,
  pickup_otp_hash varchar(128),
  delivery_otp_hash varchar(128),
  pod_media_id   uuid,
  distance_km    numeric(8,2),
  charge_minor   bigint,
  cod_minor      bigint,                              -- cash to collect, if enabled
  requires_cold_chain boolean NOT NULL DEFAULT false,
  route_id       uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE TRIGGER shipments_uat BEFORE UPDATE ON shipments FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE INDEX idx_shipments_order ON shipments(order_id);
CREATE INDEX idx_shipments_rider ON shipments(rider_user_id, created_at DESC);
CREATE INDEX idx_shipments_active ON shipments(tenant_id, status) WHERE status NOT IN ('delivered','cancelled','returned');

CREATE TABLE shipment_events (
  id          uuid NOT NULL DEFAULT uuid_generate_v7(),
  shipment_id uuid NOT NULL,
  tenant_id   uuid NOT NULL,
  status      shipment_status NOT NULL,
  lat         numeric(9,6),
  lng         numeric(9,6),
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX idx_shipment_events ON shipment_events(shipment_id, created_at);

CREATE TABLE delivery_routes (                        -- Saturday Village Run (PRD §16.5 signature)
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  default_name varchar(150) NOT NULL,
  run_weekday  smallint CHECK (run_weekday BETWEEN 0 AND 6),
  village_region_ids jsonb NOT NULL DEFAULT '[]',
  vehicle_id   uuid REFERENCES vehicles(id),
  consolidation_user_id uuid REFERENCES users(id),    -- ambassador as drop point
  is_active    boolean NOT NULL DEFAULT true
);
CALL add_std_columns('delivery_routes');
-- shipments.route_id → delivery_routes.id: no FK (shipments is partitioned with
-- composite PK; cross-partition FKs to it are avoided platform-wide — app-validated)

CREATE TABLE cold_chain_logs (                        -- reefer/vaccine temperature trail (IoT, PRD §24.9/§18.12)
  id          bigserial,
  tenant_id   uuid,
  subject_type varchar(40) NOT NULL,                  -- 'shipment','bmc_unit','warehouse_chamber','vaccine_box'
  subject_id  uuid NOT NULL,
  temp_c      numeric(5,2) NOT NULL,
  humidity_pct numeric(5,2),
  device_ref  varchar(100),
  recorded_at timestamptz NOT NULL,
  is_breach   boolean NOT NULL DEFAULT false,
  PRIMARY KEY (id, recorded_at)
) PARTITION BY RANGE (recorded_at);
CREATE INDEX idx_coldchain_subject ON cold_chain_logs(subject_type, subject_id, recorded_at DESC);
CREATE INDEX idx_coldchain_breach ON cold_chain_logs(recorded_at) WHERE is_breach;

