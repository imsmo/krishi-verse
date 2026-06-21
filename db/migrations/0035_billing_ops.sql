-- ============================================================================
-- MIGRATION 0035 — BILLING-OPS (god-mode SaaS billing ops, Law 11 + Law 2/9)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it
-- in schema_migrations. NEVER edit an applied migration — add a new numbered one.
--
-- The platform billing-ops plane (apps/admin-api) operates the SaaS revenue stream that
-- already lives in 0002 (plans / subscriptions / saas_invoices). This migration adds the
-- TWO workflow tables it owns, plus dunning bookkeeping on the invoice:
--
--   billing_adjustments          — an append-only record of every MANUAL money adjustment
--                                  (goodwill credit / clawback debit) a platform billing
--                                  operator applies to a tenant. The money itself moves ONLY
--                                  via the wallet-service (Law 2/9): this row stores the
--                                  resulting ledger txn id + the idempotency key that makes
--                                  the wallet post safe to retry. NEVER a direct ledger write.
--   saas_invoice_dunning_attempts — append-only history of dunning touches (email/sms/call…)
--                                  on an overdue/issued SaaS invoice (who chased, on what
--                                  channel, with what outcome). Bounded: one row per attempt_no.
--
-- Both tables are TENANT-SCOPED (they describe a specific tenant's billing) → tenant_id + RLS,
-- exactly like the rest of the platform. kv_admin (admin-api) is RLS-bypass capable and every
-- action is audited; RLS is defence-in-depth so no other role can read across tenants.
-- saas_invoices gains a denormalised dunning counter so the worker/console can find and chase
-- overdue invoices without a join.
-- ============================================================================

-- ---------- manual billing adjustments (money moves via wallet-service; this is the record) --
CREATE TABLE billing_adjustments (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  subscription_id uuid REFERENCES subscriptions(id),
  invoice_id      uuid REFERENCES saas_invoices(id),       -- optional: adjustment against a specific invoice
  direction       varchar(10) NOT NULL CHECK (direction IN ('credit','debit')), -- credit = platform → tenant
  amount_minor    bigint NOT NULL CHECK (amount_minor > 0),                      -- minor units, never float (Law 2)
  currency_code   char(3) NOT NULL REFERENCES currencies(code),
  reason          text NOT NULL,                            -- mandatory justification (audit / §4)
  idempotency_key varchar(160) UNIQUE NOT NULL,             -- replay-safe key fed to the wallet-service (Law 3)
  wallet_txn_id   uuid NOT NULL                             -- the ledger txn the wallet-service posted
);
CALL add_std_columns('billing_adjustments');
CREATE INDEX idx_billing_adj_tenant ON billing_adjustments(tenant_id, created_at DESC, id);
CREATE INDEX idx_billing_adj_invoice ON billing_adjustments(invoice_id) WHERE invoice_id IS NOT NULL;
ALTER TABLE billing_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_adjustments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_billing_adjustments ON billing_adjustments;
CREATE POLICY tenant_isolation_billing_adjustments ON billing_adjustments
  USING (tenant_id = current_tenant_id());

-- ---------- dunning history on a SaaS invoice -------------------------------------------------
CREATE TABLE saas_invoice_dunning_attempts (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  invoice_id    uuid NOT NULL REFERENCES saas_invoices(id),
  attempt_no    smallint NOT NULL CHECK (attempt_no > 0),
  channel       varchar(20) NOT NULL CHECK (channel IN ('email','sms','whatsapp','call','in_app')),
  outcome       varchar(20) NOT NULL DEFAULT 'sent'
                  CHECK (outcome IN ('sent','promised_pay','failed','no_response')),
  note          text,
  actor_user_id uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
-- one row per (invoice, attempt_no): bounds write-amplification from a malicious replay (§4)
CREATE UNIQUE INDEX uq_dunning_invoice_attempt ON saas_invoice_dunning_attempts(invoice_id, attempt_no);
CREATE INDEX idx_dunning_invoice ON saas_invoice_dunning_attempts(invoice_id, created_at DESC, id);
ALTER TABLE saas_invoice_dunning_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE saas_invoice_dunning_attempts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_saas_invoice_dunning_attempts ON saas_invoice_dunning_attempts;
CREATE POLICY tenant_isolation_saas_invoice_dunning_attempts ON saas_invoice_dunning_attempts
  USING (tenant_id = current_tenant_id());

-- ---------- denormalised dunning counter on the invoice ---------------------------------------
ALTER TABLE saas_invoices ADD COLUMN dunning_attempts smallint NOT NULL DEFAULT 0;
ALTER TABLE saas_invoices ADD COLUMN last_dunned_at   timestamptz;
-- hot filter: find issued/overdue invoices to chase (the dunning worker's queue)
CREATE INDEX idx_saas_inv_dunnable ON saas_invoices(due_date)
  WHERE status IN ('issued','partially_paid','overdue');
