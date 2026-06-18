-- ============================================================================
-- MIGRATION 0024 — REVIEW ELIGIBILITY (verified-purchase gate)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction.
-- Reviews are VERIFIED-PURCHASE only: a party may review the counterparty of an order ONLY after that
-- order completes. The reviews module's order-completed handler records an eligibility row here (the
-- order's buyer + seller travel in the event — no cross-module read, Law 11). The review service then
-- checks this row at submit time, so the reviews table never trusts a client-supplied order linkage.
--
-- One row per completed order; it authorizes the buyer→seller review AND the seller→buyer review.
-- tenant_id + RLS like every tenant table.
-- ============================================================================
CREATE TABLE review_eligibility (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  order_id        uuid NOT NULL,
  buyer_user_id   uuid NOT NULL REFERENCES users(id),
  seller_user_id  uuid NOT NULL REFERENCES users(id),
  UNIQUE (order_id)                                   -- one eligibility per order (idempotent insert)
);
CALL add_std_columns('review_eligibility');           -- created_at/updated_at/deleted_at/created_by/updated_by
CREATE INDEX idx_review_eligibility_order ON review_eligibility(tenant_id, order_id);

-- RLS: tenant-private. (The automatic tenant-RLS pass ran in 0014, BEFORE this table existed, so apply
-- the same policy explicitly here — mirrors the 0020 backfill pattern.)
ALTER TABLE review_eligibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_eligibility FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_review_eligibility ON review_eligibility
  USING (tenant_id IS NULL OR tenant_id = current_tenant_id());
