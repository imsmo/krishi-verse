-- ============================================================================
-- MIGRATION 0019 — SETTLEMENT LINES (per-order settlement breakdown) + invoice idempotency
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction. Money-adjacent → CODEOWNERS (Law 9).
-- The ledger records the MONEY MOVES but can't cleanly attribute commission/GST/TDS back to a
-- specific seller+order for their statement. settlement_lines is the per-order, seller-tagged
-- breakdown the OrderCompletedHandler writes at settlement; the statement generator aggregates
-- un-statemented lines per seller per cycle. bigint minor units only. tenant-scoped (RLS via 0014's
-- automatic policy — settlement_lines carries tenant_id).
-- Also: enforce ONE trade invoice per order (idempotent generation).
-- ============================================================================
CREATE TABLE settlement_lines (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id),
  seller_user_id    uuid NOT NULL REFERENCES users(id),
  order_id          uuid NOT NULL,
  gross_minor       bigint NOT NULL CHECK (gross_minor >= 0),
  commission_minor  bigint NOT NULL DEFAULT 0 CHECK (commission_minor >= 0),
  gst_minor         bigint NOT NULL DEFAULT 0 CHECK (gst_minor >= 0),
  tds_minor         bigint NOT NULL DEFAULT 0 CHECK (tds_minor >= 0),
  net_minor         bigint NOT NULL CHECK (net_minor >= 0),
  statement_id      uuid REFERENCES settlement_statements(id),   -- set once rolled into a statement
  created_at        timestamptz NOT NULL DEFAULT now()
);
-- one settlement line per order (idempotent at settlement)
CREATE UNIQUE INDEX uq_settlement_line_order ON settlement_lines(tenant_id, order_id);
-- the statement generator's hot query: un-statemented lines for a seller in a period
CREATE INDEX idx_settlement_lines_open ON settlement_lines(tenant_id, seller_user_id, created_at) WHERE statement_id IS NULL;

ALTER TABLE settlement_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_lines FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_settlement_lines ON settlement_lines
  USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());

-- one trade invoice per order (idempotent generation)
CREATE UNIQUE INDEX uq_trade_invoice_order ON trade_invoices(tenant_id, order_id);
-- carry the order's parties so the invoice read can be ownership-gated (buyer/seller) without a
-- cross-module lookup — anti-IDOR (a non-party gets 404). GSTIN columns already exist (0006).
ALTER TABLE trade_invoices ADD COLUMN IF NOT EXISTS buyer_user_id uuid;
ALTER TABLE trade_invoices ADD COLUMN IF NOT EXISTS seller_user_id uuid;
