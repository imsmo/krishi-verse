-- ============================================================================
-- MIGRATION 0050 — eKYC SESSIONS (Aadhaar/PAN verification flow, P0-11)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it in schema_migrations.
-- NEVER edit an applied migration — add a new numbered one.
--
-- A user starts an eKYC verification: we validate the raw Aadhaar/PAN locally (format + checksum), hand it to the
-- external provider's start(), and persist a SESSION that binds the provider's opaque reference to (tenant,user) so
-- the subsequent OTP verify is anti-IDOR (only the same caller, same tenant, can complete it). On success the
-- verified VAULT REF + last-4 land on users.* and a verified kyc_document row is written — NOT here.
--
-- CONTRACT (DPDP / PII minimisation, Law): this table NEVER holds the raw Aadhaar/PAN. It holds only:
--   • provider_ref  — opaque token at the provider (no id material),
--   • masked_id      — display mask ('XXXXXXXX1234' / 'ABCDE****F'),
--   • last4          — last four digits only (for display/audit),
--   • attempts/status — abuse cap + state machine (pending→verified|failed|expired).
-- No raw id, no OTP, no vault ref is stored on the session (the vault ref lives on users.* once verified).
-- tenant-scoped + RLS.
-- ============================================================================

CREATE TABLE ekyc_sessions (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  user_id       uuid NOT NULL REFERENCES users(id),
  doc_type      varchar(16) NOT NULL CHECK (doc_type IN ('aadhaar','pan')),
  provider_code varchar(30) NOT NULL,                 -- 'sandbox' | 'digilocker' | 'http' …
  provider_ref  varchar(160) NOT NULL,                -- opaque provider session/transaction id (NO id material)
  masked_id     varchar(40) NOT NULL,                 -- e.g. 'XXXXXXXX1234' / 'ABCDE****F' — masked, never raw
  last4         varchar(4) NOT NULL,                  -- last four digits only (display/audit)
  name_match    boolean,                              -- provider name-match signal (set on verify)
  otp_required  boolean NOT NULL DEFAULT true,
  attempts      integer NOT NULL DEFAULT 0,           -- failed OTP attempts (abuse cap, see service)
  status        varchar(16) NOT NULL DEFAULT 'pending'   -- pending→(verified|failed|expired)
                CHECK (status IN ('pending','verified','failed','expired')),
  failure_reason varchar(60),                         -- last failure (never contains the raw id/OTP)
  valid_until   timestamptz,                          -- provider credential validity (verified sessions)
  expires_at    timestamptz NOT NULL,                 -- the session itself expires (start window)
  verified_at   timestamptz,
  version       integer NOT NULL DEFAULT 0            -- optimistic lock
);
CALL add_std_columns('ekyc_sessions');
-- at most one in-flight (pending) session per (user, doc_type); terminal sessions don't block a fresh start
CREATE UNIQUE INDEX uq_ekyc_session_pending ON ekyc_sessions(tenant_id, user_id, doc_type)
  WHERE status = 'pending';
CREATE INDEX idx_ekyc_sessions_user ON ekyc_sessions(tenant_id, user_id, created_at DESC);

-- An eKYC verification has NO uploaded document image — the proof is the provider's cryptographic attestation
-- (vault ref), not a scanned card. So a verified kyc_documents row written by the eKYC flow has media_id NULL.
-- Relax the NOT NULL (the manual-submit DTO still requires a media id at the app layer, so that path is unaffected).
ALTER TABLE kyc_documents ALTER COLUMN media_id DROP NOT NULL;

-- RLS — re-run the idempotent tenant-isolation pass (0014/0020/0048/0049) for the new tenant table.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT t.tablename
    FROM pg_tables t
    JOIN information_schema.columns c
      ON c.table_schema='public' AND c.table_name=t.tablename AND c.column_name='tenant_id'
    WHERE t.schemaname='public'
      AND t.tablename NOT IN ('wallet_accounts','ledger_entries','ledger_transactions','reconciliation_runs')
      AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=t.tablename)
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', r.tablename);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', r.tablename);
    EXECUTE format($f$CREATE POLICY tenant_isolation_%s ON %I
                     USING (tenant_id IS NULL OR tenant_id = current_tenant_id());$f$,
                   r.tablename, r.tablename);
  END LOOP;
END $$;
