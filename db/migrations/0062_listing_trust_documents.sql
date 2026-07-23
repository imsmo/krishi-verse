-- ============================================================================
-- MIGRATION 0062 — LISTING TRUST DOCUMENTS (KV-BL-031, screen 112 trust badge)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it in schema_migrations.
-- NEVER edit an applied migration — add a new numbered one.
--
-- WHY: screen 112's trust badge lets a seller attach supporting evidence (a lab report / certification / other
-- doc) to a listing to raise buyer confidence. The mobile already uploads the file through the generic media
-- pipeline (EXIF-stripped, AV-scanned) and gets a media_id (media_assets, kind='document'), but there was no
-- endpoint or table linking that media_id to a LISTING — 03_API_CONTRACT_DELTA.md's listings section confirms
-- this by direct read of controllers/listings.controller.ts (no `trust-documents` route anywhere). This table
-- links a listing ↔ a clean media asset ↔ a doc type. The raw file lives in object storage behind the media
-- pipeline; here we store only the reference + metadata. tenant-scoped + RLS. Soft-deletable (detach) via the
-- standard deleted_at column. Mirrors 0052_scheme_application_documents.sql's shape.
--
-- verified_at stays NULL in this pass: verification is a separate ops/moderation flow, explicitly out of scope
-- for KV-BL-031 (the API only links the document; nothing here marks it verified).
-- ============================================================================

CREATE TABLE listing_trust_documents (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  listing_id    uuid NOT NULL REFERENCES listings(id),
  media_id      uuid NOT NULL REFERENCES media_assets(id),       -- clean, scanned document asset (verified at attach time)
  doc_type      varchar(20) NOT NULL CHECK (doc_type IN ('lab_report','certification','other')),
  verified_at   timestamptz,                                     -- ops verification flow (out of scope here); NULL until that ships
  uploaded_by   uuid NOT NULL REFERENCES users(id)                -- the actor who attached it (audit/anti-IDOR)
);
CALL add_std_columns('listing_trust_documents');

-- One LIVE attachment per (listing, media) — re-attaching the same file is a no-op, not a duplicate.
CREATE UNIQUE INDEX uq_listing_trust_doc ON listing_trust_documents(listing_id, media_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_listing_trust_doc_listing ON listing_trust_documents(tenant_id, listing_id) WHERE deleted_at IS NULL;

-- RLS — re-run the idempotent tenant-isolation pass (0014/.../0061) for the new tenant table.
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
