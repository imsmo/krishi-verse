// modules/auctions/jobs/close-ended-auctions.job.ts
// Worker job (kv_relay): close auctions whose ends_at has passed — resolve the winner (reserve +
// min-bidders) and RELEASE every bidder's EMD (handled inside AuctionService.closeAndResolve, so
// the dedicated release-losing-emd job is folded in here). Claims across tenants (SKIP LOCKED),
// bounded per tick; each close is idempotent (skips non-biddable).
import type { Pool } from 'pg';
import { TxContext } from '../../../core/database/unit-of-work';
import { AuctionRepository } from '../repositories/auction.repository';
import { AuctionService } from '../services/auction.service';

export class CloseEndedAuctionsJob {
  constructor(private readonly systemPool: Pool, private readonly repo: AuctionRepository, private readonly auctions: AuctionService) {}

  async run(limit = 100): Promise<{ closed: number; failed: number }> {
    const client = await this.systemPool.connect();
    let due: Array<{ id: string; tenantId: string }> = [];
    try {
      await client.query('BEGIN');
      const tx: TxContext = { query: (sql, params) => client.query(sql, params as any) as any, tenantId: '', userId: 'system' };
      due = (await this.repo.findDueToClose(tx, new Date(), limit)).map((a) => ({ id: a.id, tenantId: a.toProps().tenantId }));
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK').catch(() => undefined); throw e; } finally { client.release(); }

    let closed = 0, failed = 0;
    for (const d of due) { try { await this.auctions.closeAndResolve(d.tenantId, d.id); closed++; } catch { failed++; } }
    return { closed, failed };
  }
}
