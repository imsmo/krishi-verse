// modules/payments/jobs/payout-execution.job.ts
// Worker job (runs in apps/worker as the BYPASSRLS kv_relay role): atomically claims queued payouts
// across tenants (marks them 'processing' so no other worker re-runs them — FOR UPDATE SKIP LOCKED),
// then disburses each via PayoutService.execute (gateway call + ledger + success/reversal). Bounded
// per tick. A claimed payout whose execution throws (ambiguous transport error) stays 'processing'
// and is reconciled/retried — never silently lost, never double-disbursed (PSP idempotency key).
import type { Pool } from 'pg';
import { TxContext } from '../../../core/database/unit-of-work';
import { PayoutRepository } from '../repositories/payout.repository';
import { PayoutService } from '../services/payout.service';

export class PayoutExecutionJob {
  constructor(private readonly systemPool: Pool, private readonly repo: PayoutRepository, private readonly payouts: PayoutService) {}

  async run(limit = 50): Promise<{ claimed: number; executed: number; failed: number }> {
    // 1) claim a batch (own tx; commit so the 'processing' marks are visible before we disburse)
    const client = await this.systemPool.connect();
    let claimed: Array<{ id: string; tenantId: string }> = [];
    try {
      await client.query('BEGIN');
      const tx: TxContext = { query: (sql, params) => client.query(sql, params as any) as any, tenantId: '', userId: 'system' };
      claimed = await this.repo.claimQueued(tx, limit);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally {
      client.release();
    }

    // 2) disburse each (its own tenant-scoped tx via PayoutService.execute)
    let executed = 0, failed = 0;
    for (const c of claimed) {
      try { await this.payouts.execute(c.tenantId, c.id); executed++; }
      catch { failed++; /* stays 'processing' → reconciliation/retry; never double-disbursed */ }
    }
    return { claimed: claimed.length, executed, failed };
  }
}
