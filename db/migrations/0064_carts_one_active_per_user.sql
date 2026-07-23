-- 0064_carts_one_active_per_user.sql
-- FIX (S6 device-test, found by demo-seed): the carts table shipped with
--   UNIQUE (tenant_id, user_id, status)
-- which permits only ONE cart PER STATUS per user — FOREVER. After a buyer's first
-- checkout their cart becomes status='converted'; the SECOND checkout's markConverted
-- (UPDATE carts SET status='converted') then collides with that first converted row →
-- "duplicate key value violates unique constraint carts_tenant_id_user_id_status_key".
-- Net effect: a buyer could place exactly ONE order in their lifetime; every subsequent
-- checkout 500'd. This blocks the entire repeat-purchase loop.
--
-- The real invariant is: a user may have at most ONE *active* cart at a time. Converted
-- and abandoned carts are historical and unbounded. So we drop the over-broad 3-column
-- unique constraint and replace it with a PARTIAL unique index on the active status only
-- (mirrors uq_bank_primary_user / the wallet partial-unique pattern in 0003/0006).
--
-- Idempotent + safe: the constraint name is Postgres's auto-generated default for the
-- inline UNIQUE in 0005. Existing data cannot violate the new index (the old constraint
-- already guaranteed ≤1 active cart per user), so this applies cleanly.

ALTER TABLE carts DROP CONSTRAINT IF EXISTS carts_tenant_id_user_id_status_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_carts_one_active_per_user
  ON carts (tenant_id, user_id)
  WHERE status = 'active' AND deleted_at IS NULL;
