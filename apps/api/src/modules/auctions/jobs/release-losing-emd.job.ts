// modules/auctions/jobs/release-losing-emd.job.ts
// Worker job (kv_relay): the decoupled / backstop path that RELEASES the EMD holds of LOSING bidders
// for recently-closed auctions (the winner keeps their hold until they pay — see the payment-succeeded
// handler). Decoupling release from the close tx matters at scale: an auction with thousands of bidders
// shouldn't unwind thousands of wallet holds inside one close transaction. Claims recently-closed
// auctions across tenants (SKIP LOCKED), bounded per tick; each release is idempotent on the shared
// `emd-release:` wallet key, so a re-run (or an auction already drained at close) is a harmless no-op.
// NOT a DI provider — apps/worker instantiates it with the kv_relay Pool, mirroring the other jobs.
import type { Pool } from 'pg';
import { TxContext } from '../../../core/database/unit-of-work';
import { AuctionRepository } from '../repositories/auction.repository';
import { AuctionService } from '../services/auction.service';

export class ReleaseLosingEmdJob {
  constructor(private readonly systemPool: Pool, private readonly repo: AuctionRepository, private readonly auctions: AuctionService) {}

  /** `windowMins` bounds the scan to auctions closed recently (idempotent re-scan, partition-friendly). */
  async run(windowMins = 1440, limit = 100): Promise<{ scanned: number; released: number; failed: number }> {
    const client = await this.systemPool.connect();
    let closed: Array<{ id: string; tenantId: string }> = [];
    try {
      await client.query('BEGIN');
      const tx: TxContext = { query: (sql, params) => client.query(sql, params as any) as any, tenantId: '', userId: 'system' };
      const since = new Date(Date.now() - windowMins * 60_000);
      closed = (await this.repo.findRecentlyClosed(tx, since, limit)).map((a) => ({ id: a.id, tenantId: a.toProps().tenantId }));
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK').catch(() => undefined); throw e; } finally { client.release(); }

    let released = 0, failed = 0;
    for (const c of closed) { try { const r = await this.auctions.releaseLosingEmd(c.tenantId, c.id); released += r.released; } catch { failed++; } }
    return { scanned: closed.length, released, failed };
  }
}
