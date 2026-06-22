// modules/catalogue/jobs/batch-expiry-alerts.job.ts
// Worker job (kv_relay): emit a catalogue.batch_expiring alert for in-stock store batches expiring within N days
// (default 30). Claims across tenants (FOR UPDATE SKIP LOCKED), bounded per tick; each alert is written to the
// outbox in its own tx via ProductBatchService.flagExpiring (no batch state change). Runs daily — re-emits a
// reminder per due batch; the communication layer dedups/rate-limits per recipient. NOT a DI provider —
// apps/worker instantiates it with the kv_relay pool. Mirrors offers/jobs/expire-offers.job.
import type { Pool } from 'pg';
import { TxContext } from '../../../core/database/unit-of-work';
import { ProductBatchRepository } from '../repositories/product-batch.repository';
import { ProductBatchService } from '../services/product-batch.service';

export class BatchExpiryAlertsJob {
  constructor(private readonly systemPool: Pool, private readonly repo: ProductBatchRepository, private readonly batches: ProductBatchService) {}

  async run(withinDays = 30, limit = 500): Promise<{ alerted: number; failed: number }> {
    const client = await this.systemPool.connect();
    let due: Array<{ id: string; tenantId: string; productId: string; expiryDate: string }> = [];
    try {
      await client.query('BEGIN');
      const tx: TxContext = { query: (sql, params) => client.query(sql, params as any) as any, tenantId: '', userId: 'system' };
      due = await this.repo.findExpiringSoon(tx, new Date(), withinDays, limit);
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK').catch(() => undefined); throw e; } finally { client.release(); }

    let alerted = 0, failed = 0;
    for (const d of due) { try { await this.batches.flagExpiring(d.tenantId, d.id, d.productId, d.expiryDate); alerted++; } catch { failed++; } }
    return { alerted, failed };
  }
}
