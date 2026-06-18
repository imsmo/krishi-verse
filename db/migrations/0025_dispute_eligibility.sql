-- ============================================================================
-- MIGRATION 0025 — DISPUTE ELIGIBILITY (who-can-dispute gate + party resolution)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction.
-- A dispute may be raised only by a PARTY to a delivered order, and `against_user` must be the
-- counterparty — never client-supplied (anti-IDOR). The disputes module's order-delivered handler
-- records the order's buyer+seller here (they travel in the event — no cross-module read, Law 11). The
-- dispute service then resolves the raiser→counterparty from this row at raise time.
--
-- One row per order; tenant_id + RLS like every tenant table.
-- ============================================================================
CREATE TABLE dispute_eligibility (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  order_id        uuid NOT NULL,
  buyer_user_id   uuid NOT NULL REFERENCES users(id),
  seller_user_id  uuid NOT NULL REFERENCES users(id),
  UNIQUE (order_id)
);
CALL add_std_columns('dispute_eligibility');
CREATE INDEX idx_dispute_eligibility_order ON dispute_eligibility(tenant_id, order_id);

-- RLS: tenant-private (this table is created AFTER the 0014 auto-pass, so apply the policy explicitly —
-- mirrors the 0020 backfill / 0024 pattern).
ALTER TABLE dispute_eligibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_eligibility FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_dispute_eligibility ON dispute_eligibility
  USING (tenant_id IS NULL OR tenant_id = current_tenant_id());
