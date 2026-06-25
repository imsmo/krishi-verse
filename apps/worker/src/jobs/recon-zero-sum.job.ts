// apps/worker/src/jobs/recon-zero-sum.job.ts · MONEY safety monitor. Counts ledger txns whose legs don't sum to
// zero over a bounded recent window, records a reconciliation_runs row, and gauges the result so the
// WalletReconMismatch alert (ops/alerts/wallet-alerts.yml) has live series. Read-only over the ledger.
import { Job, JobCtx } from './index';

export const reconZeroSumJob: Job = {
  name: 'recon-zero-sum',
  intervalSec: 300, // every 5 min
  async run({ client, metrics }: JobCtx) {
    const win = await client.query<{ txn_id: string }>(
      `SELECT txn_id FROM ledger_entries
        WHERE created_at >= now() - interval '24 hours'
        GROUP BY txn_id HAVING SUM(amount_minor) <> 0
        LIMIT 1000`);
    const mismatches = win.rowCount ?? 0;
    await client.query(
      `INSERT INTO reconciliation_runs (id, check_type, window_hours, checked_count, mismatch_count, ok, started_at, finished_at)
       VALUES (uuid_generate_v7(), 'zero_sum_monitor', 24, $1, $1, $2, now(), now())
       ON CONFLICT DO NOTHING`,
      [mismatches, mismatches === 0]).catch(() => { /* schema variance tolerated; the gauge is the alert source */ });
    metrics.setGauge('kv_recon_mismatches', mismatches);
    metrics.setGauge('kv_recon_age_seconds', 0); // fresh as of this run
  },
};
