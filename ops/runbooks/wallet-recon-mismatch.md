# Runbook: wallet reconciliation mismatch (LEDGER IMBALANCE) — SEV0 / money

**Page source:** `WalletReconMismatch` (Σ legs ≠ 0). This is the highest-severity money alert. Do NOT deploy.
1. Ack + declare SEV0. Notify finance lead + CTO (escalation matrix).
2. **Freeze the affected accounts** via admin-api recon-monitor (account_freeze_orders) — stop the bleeding.
3. Identify the bad txn: `SELECT txn_id, SUM(amount_minor) FROM ledger_entries GROUP BY txn_id HAVING SUM(amount_minor)<>0;`
4. Trace the originating handler (payments capture / payout / dispute refund) via `reference_type/reference_id`.
5. Do NOT hand-edit the ledger. Post a correcting double-entry txn through the wallet-service (zero-sum) with an
   audited reason, or restore from PITR if corruption is broad.
6. Root cause → add a regression test that reproduces it. Postmortem.
