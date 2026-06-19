// modules/dairy/jobs/milk-bill-cycle-close.job.ts
// Worker job (kv_relay): at each cycle close, generate draft milk bills for every membership with unbilled
// collections in the window. Claims across tenants, bounded per tick; each generate() is idempotent per
// (membership, period) via UNIQUE(membership_id, period_start, period_end) and skips empty windows. NOT a
// DI provider (it takes a privileged Pool) — instantiated by apps/worker. Mirrors the other batch jobs.
import type { Pool } from 'pg';
import { TxContext } from '../../../core/database/unit-of-work';
import { MilkCollectionRepository } from '../repositories/milk-collection.repository';
import { MilkBillService } from '../services/milk-bill.service';

export class MilkBillCycleCloseJob {
  constructor(private readonly systemPool: Pool, private readonly collections: MilkCollectionRepository, private readonly bills: MilkBillService) {}

  /** Generate bills for the window [from,to]. Returns counts. */
  async run(from: string, to: string, limit = 500): Promise<{ generated: number; skipped: number; failed: number }> {
    const client = await this.systemPool.connect();
    let due: Array<{ tenantId: string; membershipId: string }> = [];
    try {
      await client.query('BEGIN');
      const tx: TxContext = { query: (sql, params) => client.query(sql, params as any) as any, tenantId: '', userId: 'system' };
      due = await this.collections.findMembershipsToBill(tx, from, to, limit);
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK').catch(() => undefined); throw e; } finally { client.release(); }

    let generated = 0, skipped = 0, failed = 0;
    const sysActor = { userId: 'system', canManage: true };
    for (const d of due) {
      try {
        await this.bills.generate(d.tenantId, sysActor, `cycleclose:${d.membershipId}:${from}:${to}`, { membershipId: d.membershipId, periodStart: from, periodEnd: to, deductions: [] });
        generated++;
      } catch (e: any) {
        if (e?.code === 'EMPTY_BILL' || e?.code === 'BILL_NOT_PAYABLE') skipped++; else failed++;
      }
    }
    return { generated, skipped, failed };
  }
}
