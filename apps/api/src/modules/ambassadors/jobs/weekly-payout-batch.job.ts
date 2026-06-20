// modules/ambassadors/jobs/weekly-payout-batch.job.ts · the worker's weekly commission payout runner.
// Connected as the BYPASSRLS relay role (like the outbox relay), it finds every (tenant, ambassador) with
// unpaid earnings and settles each via AmbassadorEarningService.payoutAmbassador (one zero-sum 'commission'
// wallet transfer per ambassador, idempotent). A single ambassador's failure never aborts the batch.
import type { Pool } from 'pg';
import { AmbassadorEarningService } from '../services/ambassador-earning.service';

export interface PayoutBatchResult { attempted: number; paid: number; failed: number; }

export async function runWeeklyPayout(relayPool: Pool, service: AmbassadorEarningService, batchKey = new Date().toISOString().slice(0, 10)): Promise<PayoutBatchResult> {
  const r = await relayPool.query(`SELECT DISTINCT tenant_id, ambassador_id FROM ambassador_earnings WHERE payout_id IS NULL`);
  const result: PayoutBatchResult = { attempted: r.rows.length, paid: 0, failed: 0 };
  for (const row of r.rows) {
    try {
      // idempotency key is stable per (ambassador, batch window) so a re-run never double-pays
      await service.payoutAmbassador(row.tenant_id, row.ambassador_id, `ambbatch:${row.ambassador_id}:${batchKey}`);
      result.paid++;
    } catch { result.failed++; }   // NOTHING_TO_PAYOUT (raced) or transient — next run retries
  }
  return result;
}
