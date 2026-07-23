-- ============================================================================
-- MIGRATION 0055 — PER-PARTICIPANT CONVERSATION ARCHIVE (contract-gap P0-1)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it in schema_migrations.
-- NEVER edit an applied migration — add a new numbered one.
--
-- WHY: the mobile Messages inbox (191) + Archive (192) need an ARCHIVE affordance, but there was no schema for it,
-- so the app degraded to showing server-locked threads read-only (flagged §13). Archive is a PER-PARTICIPANT UI
-- state — one party archiving a thread must NOT hide it for the other — so the flag lives on conversation_participants
-- (the membership row), never on the shared conversations row. `last_read_at` (already present) drives the unread
-- count; these two columns complete the conversation-summary read-model. No tenant_id on this table (it is always
-- joined to conversations on tenant_id — RLS is enforced there), so no RLS pass is needed.
-- ============================================================================

ALTER TABLE conversation_participants
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- The inbox lists a participant's NON-archived threads; the archive lists their archived ones. Index the caller's
-- own rows by archive state so both reads stay index-only on a hot table.
CREATE INDEX IF NOT EXISTS idx_conv_participants_user_archived
  ON conversation_participants(user_id, is_archived);
