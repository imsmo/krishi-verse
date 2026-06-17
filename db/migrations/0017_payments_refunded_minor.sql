-- ============================================================================
-- MIGRATION 0017 — PAYMENTS: track refunded amount for partial refunds
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction.
-- Touches the payments table (money-adjacent) — CODEOWNERS review (Law 9).
-- The payments table (0006) records status (refunded|partially_refunded) but not HOW MUCH has
-- been refunded; partial refunds need the running total to compute the refundable balance and to
-- decide partial vs full. bigint minor units, never float.
-- ============================================================================
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refunded_minor bigint NOT NULL DEFAULT 0
  CHECK (refunded_minor >= 0 AND refunded_minor <= amount_minor);
