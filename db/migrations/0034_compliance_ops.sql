-- ============================================================================
-- MIGRATION 0034 — COMPLIANCE-OPS (god-mode DPDP/compliance plane, Law 11)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction.
-- Adds the platform compliance plane's missing schema:
--   (1) data_breaches — the DPDP §8 breach-notification incident register (open→contained→notified→closed),
--       operated ONLY by kv_admin in apps/admin-api. It's a PLATFORM/god-mode table: it uses affected_tenant_id
--       (NOT a `tenant_id` column) so the idempotent RLS pass skips it — there is no tenant self-service here.
--   (2) data_export_jobs APPROVAL gate — a tenant full-export / DPDP portability bundle is a major data-egress;
--       it MUST be approved by platform compliance before the worker runs it. We add approval_status +
--       approved_by/approved_at/rejected_reason; the export worker only picks up status='queued' AND
--       approval_status='approved' (that worker filter is apps/worker's job — admin-api owns the APPROVAL write).
-- The DSR queue (data_subject_requests, 0003) and retention policies (data_retention_policies, 0015) already
-- exist; compliance-ops operates them — no schema change needed there.
-- ============================================================================

-- (1) DPDP breach-notification register
CREATE TABLE data_breaches (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  affected_tenant_id uuid REFERENCES tenants(id),       -- NULL = platform-wide; NOT named tenant_id (no RLS)
  status             varchar(20) NOT NULL DEFAULT 'open'
                       CHECK (status IN ('open','contained','notified','closed')),
  severity           varchar(10) NOT NULL DEFAULT 'high'
                       CHECK (severity IN ('low','medium','high','critical')),
  title              varchar(200) NOT NULL,
  description        text NOT NULL,
  affected_data      text NOT NULL,                     -- categories affected (e.g. 'phone,email') — NO raw PII
  affected_count     bigint NOT NULL DEFAULT 0,         -- estimated # of data principals
  detected_at        timestamptz NOT NULL,
  contained_at       timestamptz,
  regulator_notified_at timestamptz,                    -- DPB notification (DPDP §8)
  principals_notified_at timestamptz,                   -- data-principal notification
  closed_at          timestamptz,
  opened_by          uuid NOT NULL,
  resolution_note    text
);
CALL add_std_columns('data_breaches');
CREATE INDEX idx_breaches_list ON data_breaches(status, created_at DESC, id);
CREATE INDEX idx_breaches_tenant ON data_breaches(affected_tenant_id, created_at DESC);

-- (2) export-job approval gate (DPDP portability / tenant offboarding data-egress control)
ALTER TABLE data_export_jobs
  ADD COLUMN IF NOT EXISTS approval_status varchar(10) NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS approved_by     uuid,
  ADD COLUMN IF NOT EXISTS approved_at     timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_reason text;
-- the export worker claims only approved, still-queued jobs:
CREATE INDEX IF NOT EXISTS idx_export_jobs_runnable ON data_export_jobs(status) WHERE approval_status='approved';
