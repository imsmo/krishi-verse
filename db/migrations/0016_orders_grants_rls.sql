-- ============================================================================
-- MIGRATION 0016 — ORDERS: app-role DELETE grants + cart_items RLS
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction.
-- Why this exists (surfaced by the orders module running against the real schema):
--   1. kv_app (least-privilege app role) is granted SELECT/INSERT/UPDATE in 0014 but
--      NOT DELETE. The cart flow hard-deletes cart_items (remove item / clear cart) and
--      the idempotency layer deletes its in-flight claim on failure. Without DELETE,
--      those operations fail in production. Grant DELETE on exactly those two tables.
--   2. cart_items has NO tenant_id column, so the automatic RLS in 0014 (which targets
--      tables owning tenant_id) skipped it. Add tenant isolation transitively via its
--      parent cart, so a cart line can never be read/written across tenants even if a
--      cart_id leaks. (order_items/order_events already carry tenant_id and are covered.)
-- ============================================================================

-- 1) DELETE grants (least privilege: only the tables the app actually deletes from)
GRANT DELETE ON cart_items     TO kv_app;
GRANT DELETE ON idempotency_keys TO kv_app;

-- 2) Defense-in-depth RLS for cart_items (isolation via the parent cart's tenant)
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_cart_items ON cart_items;
CREATE POLICY tenant_isolation_cart_items ON cart_items
  USING (EXISTS (SELECT 1 FROM carts c WHERE c.id = cart_items.cart_id AND c.tenant_id = current_tenant_id()));
