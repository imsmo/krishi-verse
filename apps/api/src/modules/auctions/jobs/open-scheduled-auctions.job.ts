// modules/auctions/jobs/open-scheduled-auctions.job.ts
// Worker job (kv_relay): open scheduled auctions whose starts_at has passed. Claims across tenants
// (FOR UPDATE SKIP LOCKED), bounded per tick; each open() is idempotent (skips non-scheduled).
import type { Pool } from 'pg';
import { TxContext } from '../../../core/database/unit-of-work';
import { AuctionRepository } from '../repositories/auction.repository';
import { AuctionService } from '../services/auction.service';

export class OpenScheduledAuctionsJob {
  constructor(private readonly systemPool: Pool, private readonly repo: AuctionRepository, private readonly auctions: AuctionService) {}

  async run(limit = 100): Promise<{ opened: number; failed: number }> {
    const client = await this.systemPool.connect();
    let due: Array<{ id: string; tenantId: string }> = [];
    try {
      await client.query('BEGIN');
      const tx: TxContext = { query: (sql, params) => client.query(sql, params as any) as any, tenantId: '', userId: 'system' };
      due = (await this.repo.findDueToOpen(tx, new Date(), limit)).map((a) => ({ id: a.id, tenantId: a.toProps().tenantId }));
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK').catch(() => undefined); throw e; } finally { client.release(); }

    let opened = 0, failed = 0;
    for (const d of due) { try { await this.auctions.open(d.tenantId, d.id); opened++; } catch { failed++; } }
    return { opened, failed };
  }
}
