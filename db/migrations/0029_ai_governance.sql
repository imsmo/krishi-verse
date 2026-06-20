-- ============================================================================
-- MIGRATION 0029 — AI GOVERNANCE indexes + abuse guards (PRD §8.3)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction.
-- The ai-governance tables (ai_models / ai_inferences / ai_review_queue / moderation_reports) and their RLS
-- already exist (created in 0013, RLS-protected by the 0014 tenant-isolation pass — ai_models is GLOBAL with no
-- tenant_id, the rest are tenant-scoped). This migration only ADDS the indexes the live access paths need
-- (keyset pagination, the HITL claim order, the inference→subject lookup) plus an abuse guard that stops a
-- single user mass-filing duplicate moderation reports against the same subject. Additive + idempotent
-- (IF NOT EXISTS); no table or RLS changes.
-- ============================================================================

-- 1. ai_models — registry browse (read-only in the tenant API; authoring is admin-api, Law 11). List the live
--    registry ordered newest-first, keyset on (created_at, id); resolve the active model for a code fast.
CREATE INDEX IF NOT EXISTS idx_ai_models_keyset ON ai_models(created_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_ai_models_code_status ON ai_models(code, status);

-- 2. ai_inferences — append-only audit log (PARTITIONED by created_at; partitions auto-managed by
--    ensure_partitions). A tenant timeline is keyset on (created_at, id) and bounded by the partition key so PG
--    prunes to the relevant month(s) (Law 8). idx_ai_inferences_subject (0013) already covers subject lookups.
CREATE INDEX IF NOT EXISTS idx_ai_inferences_tenant ON ai_inferences(tenant_id, created_at DESC, id);

-- 3. ai_review_queue — human-in-the-loop. Open items are pulled highest-priority-first, then oldest
--    (priority ASC = most urgent first per the seed's 100-default convention is HIGHER number = lower urgency,
--    so ORDER BY priority ASC, created_at ASC). The list view is keyset on (created_at, id).
CREATE INDEX IF NOT EXISTS idx_ai_queue_claim ON ai_review_queue(tenant_id, priority, created_at, id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_ai_queue_keyset ON ai_review_queue(tenant_id, created_at DESC, id);

-- 4. moderation_reports — keyset list of open reports; ABUSE GUARD: one reporter may file only ONE live report
--    per subject (a malicious user mass-reporting the same listing creates exactly one row, not unbounded
--    write amplification — §4). System/auto reports (reporter_user_id NULL) are exempt. Soft-deleted rows
--    don't block a fresh report.
CREATE INDEX IF NOT EXISTS idx_modreports_keyset ON moderation_reports(tenant_id, created_at DESC, id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_modreport_one_per_reporter
  ON moderation_reports(tenant_id, subject_type, subject_id, reporter_user_id)
  WHERE reporter_user_id IS NOT NULL AND deleted_at IS NULL;
