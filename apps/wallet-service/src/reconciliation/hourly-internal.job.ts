// apps/wallet-service/src/reconciliation/hourly-internal.job.ts · scheduled runner: each account's cached
// balance must equal the sum of its ledger entries. A mismatch = a cached balance drifted → sev-1.
import { WalletPool } from '../core/database/pg-pool.provider';
import { ReconciliationService, ReconResult } from './reconciliation.service';

export async function runHourlyInternalCheck(pool: WalletPool, recon: ReconciliationService): Promise<ReconResult> {
  return pool.withTx((tx) => recon.runInternalBalanceCheck(tx));
}
