-- ============================================================================
-- MIGRATION 0021 — ORDER ↔ OFFER link (order-from-accepted-offer)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction.
-- An accepted listing_offer becomes a real order (source='offer'). Mirror the existing
-- auction_id / requirement_id provenance columns on `orders` with an offer_id, so an
-- offer-sourced order is traceable back to its negotiation. Set by the orders-side outbox
-- handler that reacts to offers.offer_accepted; the offers side then links converted_order_id.
--
-- `orders` is PARTITIONED BY RANGE (created_at). A UNIQUE index on a partitioned table must
-- include the partition key, which cannot enforce global uniqueness on offer_id alone — so we use
-- a NON-unique partial index for fast idempotency lookups (the handler does a check-then-insert in
-- its relay tx, and offers.accept() already forbids double-accept, so a duplicate order can't arise).
-- ============================================================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS offer_id uuid;   -- provenance: the accepted listing_offer

-- partition-local btree (propagates to every partition) for "does an order already exist for this
-- offer?" — the handler's idempotency guard. Partial: only offer-sourced orders carry it.
CREATE INDEX IF NOT EXISTS idx_orders_offer ON orders (tenant_id, offer_id) WHERE offer_id IS NOT NULL;
