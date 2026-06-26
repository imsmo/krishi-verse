-- ============================================================================
-- MIGRATION 0052 — SCHEME APPLICATION DOCUMENTS (doc-attach, P1-16)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it in schema_migrations.
-- NEVER edit an applied migration — add a new numbered one.
--
-- WHY: a scheme application collects supporting documents (the scheme's `required_doc_type_ids`). The mobile
-- already uploads each file through the media pipeline (EXIF-stripped, AV-scanned) and gets a media_id, but there
-- was NO endpoint to ATTACH that media_id to the application against a required doc type — the ids sat unused in
-- form data (flagged). This table links an application ↔ a clean media asset ↔ (optionally) a required doc type.
-- The raw file lives in object storage behind the media pipeline; here we store only the reference + metadata.
-- tenant-scoped + RLS. Soft-deletable (detach) via the standard deleted_at column.
-- ============================================================================

CREATE TABLE scheme_application_documents (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id),
  application_id uuid NOT NULL REFERENCES scheme_applications(id),
  media_id       uuid NOT NULL REFERENCES media_assets(id),       -- clean, scanned asset (verified at attach time)
  doc_type_id    varchar(80),                                     -- one of the scheme's required_doc_type_ids (NULL = supplementary)
  note           varchar(300),                                    -- optional applicant note (no PII enforced at app layer)
  uploaded_by    uuid NOT NULL REFERENCES users(id)               -- the actor who attached it (audit/anti-IDOR)
);
CALL add_std_columns('scheme_application_documents');

-- One LIVE attachment per (application, media) — re-attaching the same file is a no-op, not a duplicate.
CREATE UNIQUE INDEX uq_scheme_app_doc ON scheme_application_documents(application_id, media_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_scheme_app_doc_app ON scheme_application_documents(tenant_id, application_id) WHERE deleted_at IS NULL;

-- RLS — re-run the idempotent tenant-isolation pass (0014/.../0051) for the new tenant table.
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
