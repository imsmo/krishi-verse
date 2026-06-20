// apps/wallet-service/src/reconciliation/zero-sum-check.job.ts · scheduled runner: every transaction in the
// window must be balanced (Σ legs = 0). A non-empty mismatch list = money created/destroyed → sev-1.
import { WalletPool } from '../core/database/pg-pool.provider';
import { ReconciliationService, ReconResult } from './reconciliation.service';

export async function runZeroSumCheck(pool: WalletPool, recon: ReconciliationService, windowHours: number): Promise<ReconResult> {
  return pool.withTx((tx) => recon.runZeroSumCheck(tx, windowHours));
}
