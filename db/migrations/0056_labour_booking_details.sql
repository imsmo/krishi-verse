-- ============================================================================
-- MIGRATION 0056 — LABOUR BOOKING DETAILS + WORKER DISCOVERABILITY (contract-gap P0-2)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it in schema_migrations.
-- NEVER edit an applied migration — add a new numbered one.
--
-- WHY: the mobile hire flow (44/45/46) + worker offer/schedule screens degrade because the labour contract had
-- (a) no start-time-of-day or free-text special-instructions on a booking, and (b) a PII-minimised worker read with
-- no way for a worker to CONSENT to being shown by name/rating/job-count (§13). This migration adds:
--   • labour_bookings.start_time (time) + notes (varchar 300)     — the missing booking fields
--   • worker_profiles.discoverable (boolean, default false)       — the worker's own consent to be listed with
--     name/photo/rating/job-count. DEFAULT false = privacy-by-default (DPDP); the worker opts IN.
-- Both tables are tenant-scoped with existing RLS; adding columns needs no policy change.
-- ============================================================================

ALTER TABLE labour_bookings
  ADD COLUMN IF NOT EXISTS start_time time,                    -- time-of-day the work starts (NULL = employer unspecified)
  ADD COLUMN IF NOT EXISTS notes      varchar(300);            -- special instructions to the worker (no PII enforced app-side)

ALTER TABLE worker_profiles
  ADD COLUMN IF NOT EXISTS discoverable boolean NOT NULL DEFAULT false;  -- worker consent to be shown with identity
