-- ============================================================================
-- MIGRATION 0049 — UPI AUTOPAY MANDATES (wallet autopay setup, P0-8)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it in schema_migrations.
-- NEVER edit an applied migration — add a new numbered one.
--
-- A user registers a UPI AutoPay mandate (standing instruction) so recurring debits (e.g. membership renewal,
-- loan EMI) can be collected without a manual approval each time. We store ONLY the gateway's tokenised mandate
-- reference + a MASKED VPA (handle@psp → "abc***@psp") — NEVER the raw VPA (DPDP minimisation, Law: PII). No money
-- lives here: an actual auto-debit still moves funds ONLY through the wallet-service ledger when the PSP confirms
-- (execution is provider-driven — webhook + worker — flagged as a follow-on). tenant-scoped + RLS.
-- ============================================================================

CREATE TABLE upi_mandates (
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id            uuid NOT NULL REFERENCES tenants(id),
  user_id              uuid NOT NULL REFERENCES users(id),
  provider_code        varchar(30) NOT NULL,                  -- 'razorpay' | 'sandbox'
  provider_mandate_ref varchar(120),                          -- tokenised mandate id from the PSP (NULL until registered)
  vpa_masked           varchar(80) NOT NULL,                  -- e.g. 'abc***@okhdfcbank' — masked, never raw
  purpose              varchar(40) NOT NULL,                  -- 'membership' | 'loan_emi' | 'general'
  max_amount_minor     bigint NOT NULL CHECK (max_amount_minor > 0),  -- per-debit cap (bigint minor units)
  currency_code        char(3) NOT NULL DEFAULT 'INR',
  frequency            varchar(16) NOT NULL DEFAULT 'as_presented'    -- as_presented|monthly|weekly|daily
                       CHECK (frequency IN ('as_presented','daily','weekly','monthly')),
  status               varchar(16) NOT NULL DEFAULT 'pending'         -- pending→active→paused→(cancelled|expired)
                       CHECK (status IN ('pending','active','paused','cancelled','expired')),
  valid_until          timestamptz,
  cancelled_reason     text,
  version              integer NOT NULL DEFAULT 0                      -- optimistic lock
);
CALL add_std_columns('upi_mandates');
-- one ACTIVE/PENDING mandate per (user, purpose); cancelled/expired don't block re-registration
CREATE UNIQUE INDEX uq_upi_mandate_active ON upi_mandates(tenant_id, user_id, purpose)
  WHERE status IN ('pending','active','paused');
CREATE INDEX idx_upi_mandates_user ON upi_mandates(tenant_id, user_id, created_at DESC);

-- RLS — re-run the idempotent tenant-isolation pass (0014/0020/0048) for the new tenant table.
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
