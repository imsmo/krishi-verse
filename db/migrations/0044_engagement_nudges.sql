-- ============================================================================
-- MIGRATION 0044 — ENGAGEMENT NUDGE TRACKING (idempotent async-glue, Wave 4 / API-W4-01)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it in schema_migrations.
-- NEVER edit an applied migration — add a new numbered one.
--
-- Two periodic worker jobs (apps/worker) emit ONE-TIME engagement notifications and must be idempotent
-- across runs (the relay fan-out keys a notification off a NEW outbox row each tick, so without a
-- "last nudged" marker a daily job would re-notify forever — a §4 abuse/DoS defect). Each job stamps the
-- timestamp it nudged and only ever picks rows it hasn't nudged (or hasn't in a long while), making the
-- sweep bounded + idempotent. Both columns are nullable + additive (no backfill, no RLS change — the
-- parent tables already FORCE row-level security; a new column inherits the table's policy).
--
--   requirements.reminded_at        — requirements/jobs/match-notifications.job.ts: a buyer whose OPEN
--                                      requirement is approaching need_by gets ONE "still open / quote it"
--                                      nudge; re-stamped only after the cool-off window.
--   review_eligibility.prompted_at  — reviews/jobs/review-prompts.job.ts: the parties of a COMPLETED order
--                                      (or service booking) get ONE "rate your counterparty" nudge.
-- ============================================================================

ALTER TABLE requirements        ADD COLUMN IF NOT EXISTS reminded_at  timestamptz;
ALTER TABLE review_eligibility  ADD COLUMN IF NOT EXISTS prompted_at  timestamptz;

-- Worker finders scan a bounded, partition-free set; partial indexes keep the "due to nudge" scan cheap
-- at billions of rows (only the not-yet-nudged / open rows are indexed).
CREATE INDEX IF NOT EXISTS idx_requirements_remind_due
  ON requirements (need_by)
  WHERE status IN ('open','partially_matched') AND reminded_at IS NULL AND need_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_review_eligibility_prompt_due
  ON review_eligibility (created_at)
  WHERE prompted_at IS NULL;
