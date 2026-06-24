-- ============================================================================
-- MIGRATION 0046 — LABOUR: 'applied' assignment status (worker self-apply, API-W8)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it in schema_migrations.
-- NEVER edit an applied migration — add a new numbered one.
--
-- Until now a booking_assignment was only ever EMPLOYER-initiated (employer proposes a worker →
-- 'pending_worker' → the worker accepts/rejects). API-W8 adds WORKER self-apply: a worker volunteers for
-- an OPEN booking, creating an assignment in a new 'applied' state — an interest pool the employer picks
-- from, distinct from a committed 'pending_worker' slot (so applications never consume booking capacity).
-- The transition applied → accepted | rejected | expired is enforced in the pure assignment state machine.
--
-- ADD VALUE is additive + idempotent; it does not rewrite the table. The value is only ADDED here (never
-- USED in this same migration), so it is safe inside the runner's transaction on PostgreSQL 12+.
-- ============================================================================

-- NOTE: a partial index WHERE status='applied' is intentionally NOT added here — Postgres forbids USING a
-- new enum value in the same transaction that ADDs it. The existing idx_bassign_worker (worker_id, created_at)
-- and the booking_id key already serve the "my applications" / "applicants for a booking" scans.
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'applied';
