-- ============================================================================
-- MIGRATION 0026 — make settlement_lines PRECISELY REVERSIBLE (dispute refund clawback)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction.
-- A dispute resolved after the order already settled must claw the escrow release back EXACTLY —
-- restoring every account (seller net, tenant commission, GST/TDS payable, platform fees) to its
-- pre-settlement balance. settlement_lines stored net + TOTAL commission + gst + tds, but not the
-- tenant-vs-platform commission split nor the platform-fees leg (= buyer charges + platform share),
-- so the original wallet legs couldn't be reproduced from the line. Add the two missing breakdown
-- amounts; the escrow-release handler populates them, and the dispute-refund handler reverses with them.
--
-- Existing rows default to 0 (they predate any dispute clawback); new settlements populate exactly.
-- ============================================================================
ALTER TABLE settlement_lines
  ADD COLUMN IF NOT EXISTS tenant_commission_minor bigint NOT NULL DEFAULT 0 CHECK (tenant_commission_minor >= 0),
  ADD COLUMN IF NOT EXISTS platform_fees_minor     bigint NOT NULL DEFAULT 0 CHECK (platform_fees_minor >= 0);
