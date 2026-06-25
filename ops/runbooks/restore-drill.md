# Runbook: DR restore drill (PITR) — quarterly + pre-launch

**Goal:** prove we can restore production within RTO/RPO. **RTO target: ≤ 60 min. RPO target: ≤ 5 min** (Aurora
continuous backups + PITR).

## Drill
1. Run `infra/scripts/backup-verify.sh` (restores the latest PITR into a throwaway clone, times it, sanity-checks).
2. Record the measured restore time vs the 60-min RTO in the drill log below.
3. Sanity query the clone writer: row counts on `payments`, `ledger_entries`, `users`; confirm
   `SELECT SUM(amount_minor) FROM ledger_entries = 0` (ledger intact).
4. Delete the clone (script prints the commands).

## Real recovery (data-loss event)
1. Incident commander declares; freeze writes (scale API to 0 / maintenance page).
2. Restore to the chosen point-in-time (just before the bad event) into a NEW cluster.
3. Repoint `DATABASE_URL` secrets + Route53 at the restored writer; run `db/prod/apply.sh` steps 5–6 (RLS gate +
   kv_app probe) — never skip the gate.
4. Reconcile (`verify-rls-coverage` + wallet zero-sum) BEFORE reopening writes.
5. Postmortem within 48h.

## Drill log
| Date | Measured RTO | RPO | Pass? | Notes |
|------|--------------|-----|-------|-------|
| | | | | |
