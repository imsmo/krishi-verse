// modules/payments/jobs/daily-gateway-recon.job.ts
// Worker job (kv_relay/kv_wallet): a once-per-UTC-day reconciliation of the payout money path against
// the ledger. Complements core/wallet ReconciliationService (zero-sum + internal-balance over the WHOLE
// ledger) with payout-SPECIFIC integrity checks that catch gateway/ledger drift:
//   • reservation_missing      — a non-cancelled payout with no reservation ledger txn (money path broken);
//   • settled_without_gateway  — a success/processing payout with no gateway id (settled off-book?);
//   • stuck_processing         — 'processing' beyond the gateway-confirmation SLA (webhook never arrived).
// A non-empty mismatch list is a sev-1 signal. The run is recorded in reconciliation_runs
// (run_type='daily_gateway'); a date guard in ops_job_runs makes it idempotent for the day (a re-run is
// a no-op). Read-only over money: it MOVES NOTHING — it OBSERVES + records. NOT a DI provider; the
// worker instantiates it with the privileged Pool.
import type { Pool, PoolClient } from 'pg';

const JOB_CODE = 'daily_gateway_recon';

export interface GatewayReconResult { ran: boolean; checked: number; mismatches: number; status: 'ok' | 'mismatch' | 'skipped'; }

export class DailyGatewayReconJob {
  constructor(private readonly systemPool: Pool) {}

  /** `stuckProcessingHours` — a payout 'processing' longer than this had no webhook confirmation. */
  async run(stuckProcessingHours = 24): Promise<GatewayReconResult> {
    const client: PoolClient = await this.systemPool.connect();
    try {
      await client.query('BEGIN');
      // date guard: at most one successful run per UTC day (idempotent)
      const already = await client.query(
        `SELECT 1 FROM ops_job_runs WHERE job_code=$1 AND status='completed' AND started_at::date = (now() AT TIME ZONE 'UTC')::date LIMIT 1`, [JOB_CODE]);
      if ((already.rowCount ?? 0) > 0) { await client.query('COMMIT'); return { ran: false, checked: 0, mismatches: 0, status: 'skipped' }; }

      const checkedR = await client.query<{ n: string }>(`SELECT count(*)::text n FROM payouts`);
      const checked = Number(checkedR.rows[0]?.n ?? 0);

      const bad = await client.query<{ id: string; tenant_id: string; reason: string }>(
        `SELECT id, tenant_id, 'reservation_missing'::text AS reason FROM payouts
           WHERE status <> 'cancelled' AND ledger_txn_id IS NULL
         UNION ALL
         SELECT id, tenant_id, 'settled_without_gateway' FROM payouts
           WHERE status IN ('success','processing') AND gateway_payout_id IS NULL
         UNION ALL
         SELECT id, tenant_id, 'stuck_processing' FROM payouts
           WHERE status='processing' AND created_at < now() - ($1 || ' hours')::interval
         LIMIT 1000`, [String(stuckProcessingHours)]);
      const mismatches = bad.rows.map((r) => ({ payoutId: r.id, tenantId: r.tenant_id, reason: r.reason }));
      const ok = mismatches.length === 0;

      await client.query(
        `INSERT INTO reconciliation_runs (run_type, period_start, period_end, status, checked_count, mismatches, finished_at)
         VALUES ('daily_gateway', now() - interval '1 day', now(), $1, $2, $3::jsonb, now())`,
        [ok ? 'ok' : 'mismatch', checked, JSON.stringify(mismatches)]);
      await client.query(
        `INSERT INTO ops_job_runs (job_code, status, detail, finished_at) VALUES ($1,'completed',$2::jsonb, now())`,
        [JOB_CODE, JSON.stringify({ checked, mismatches: mismatches.length, ok })]);

      await client.query('COMMIT');
      return { ran: true, checked, mismatches: mismatches.length, status: ok ? 'ok' : 'mismatch' };
    } catch (e) { await client.query('ROLLBACK').catch(() => undefined); throw e; } finally { client.release(); }
  }
}
