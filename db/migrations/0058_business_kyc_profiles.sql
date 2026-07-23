-- ============================================================================
-- MIGRATION 0058 — BUYER BUSINESS-KYC PROFILES (P0-5)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it in schema_migrations.
-- NEVER edit an applied migration — add a new numbered one.
--
-- A buyer's business identity for procurement KYC: business type + legal name + the GSTIN/PAN (stored MASKED only)
-- + the media ids of the uploaded proof documents. The RAW GSTIN/PAN is validated + masked in the app BEFORE it
-- reaches this table (DPDP data-minimisation, §4) — this table NEVER holds a raw tax id. One live profile per
-- (tenant, user); re-submitting updates the row and resets it to 'pending' for re-review. tenant-scoped + RLS.
-- ============================================================================

CREATE TABLE business_kyc_profiles (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id),
  user_id        uuid NOT NULL REFERENCES users(id),
  business_type  varchar(20) NOT NULL
                 CHECK (business_type IN ('proprietorship','partnership','pvt_ltd','llp','fpo','cooperative','trader','huf','other')),
  legal_name     varchar(200) NOT NULL,
  gstin_masked   varchar(20),                          -- masked GSTIN (e.g. 27******3Z5) — NEVER the raw value
  pan_masked     varchar(15),                          -- masked PAN (e.g. AB****4F) — NEVER the raw value
  doc_media_ids  uuid[] NOT NULL DEFAULT '{}',         -- uploaded proof document media ids (GST cert, PAN card, …)
  status         kyc_status NOT NULL DEFAULT 'pending',-- pending → verified | rejected (reuses the identity enum)
  reviewed_by    uuid REFERENCES users(id),
  reviewed_at    timestamptz,
  reject_reason  text
);
CALL add_std_columns('business_kyc_profiles');
-- One live profile per (tenant, user) — submit is an upsert against this partial-unique key.
CREATE UNIQUE INDEX uq_business_kyc_user ON business_kyc_profiles(tenant_id, user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_business_kyc_pending ON business_kyc_profiles(tenant_id, status) WHERE status = 'pending';

-- RLS — re-run the idempotent tenant-isolation pass for the new tenant table.
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
