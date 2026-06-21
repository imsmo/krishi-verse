-- ============================================================================
-- MIGRATION 0033 — RECON-MONITOR (god-mode money-safety ops, Law 11 + Law 9)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction.
-- The platform recon-monitor plane's OWN workflow tables. They sit ALONGSIDE the money realm (0006:
-- reconciliation_runs, wallet_accounts, ledger_*) and are operated ONLY by kv_admin in apps/admin-api — they
-- NEVER post ledger entries (money moves only via the wallet-service, Law 2). Like the wallet/recon tables,
-- these are PLATFORM/god-mode-only: no tenant_id column ⇒ the idempotent RLS pass skips them (RLS is for
-- tenant-scoped tables; these are operated by the RLS-bypassing kv_admin role and every action is audited).
--
--   recon_investigations  — when a reconciliation_run reports mismatches, an operator opens an investigation
--                           and works it (open→investigating→resolved|false_positive). Audit/workflow only.
--   account_freeze_orders — append-only history of freeze/unfreeze CONTROL actions on a wallet account. The
--                           actual debit-blocking is the wallet engine honouring wallet_accounts.is_frozen;
--                           this records WHO froze WHAT and WHY (a freeze moves NO money — zero-sum untouched).
-- ============================================================================

CREATE TABLE recon_investigations (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  run_id          uuid NOT NULL REFERENCES reconciliation_runs(id),
  status          varchar(20) NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','investigating','resolved','false_positive')),
  severity        varchar(10) NOT NULL DEFAULT 'high'
                    CHECK (severity IN ('low','medium','high','critical')),
  summary         text NOT NULL,
  assigned_to     uuid,                                  -- admin user id (platform staff)
  resolution_note text,
  opened_by       uuid NOT NULL,
  resolved_at     timestamptz
);
CALL add_std_columns('recon_investigations');
-- one OPEN/INVESTIGATING investigation per run (dedup the alert storm — abuse/write-amplification guard §4)
CREATE UNIQUE INDEX uq_recon_inv_open_per_run ON recon_investigations(run_id) WHERE status IN ('open','investigating');
CREATE INDEX idx_recon_inv_list ON recon_investigations(status, created_at DESC, id);

CREATE TABLE account_freeze_orders (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  account_id  uuid NOT NULL REFERENCES wallet_accounts(id),
  action      varchar(10) NOT NULL CHECK (action IN ('freeze','unfreeze')),
  reason      text NOT NULL,
  actor_user_id uuid NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_freeze_orders_account ON account_freeze_orders(account_id, created_at DESC, id);
