// modules/offers/jobs/expire-offers.job.ts
// Worker job (kv_relay): lapse offers whose expires_at has passed (status open|countered → expired).
// Claims across tenants (FOR UPDATE SKIP LOCKED), bounded per tick; each expire() is idempotent
// (skips offers no longer in negotiation). Mirrors the auction open/close jobs — NOT a DI provider
// (it takes a privileged Pool), instantiated by apps/worker (or tests) with the kv_relay pool.
import type { Pool } from 'pg';
import { TxContext } from '../../../core/database/unit-of-work';
import { ListingOfferRepository } from '../repositories/listing-offer.repository';
import { ListingOfferService } from '../services/listing-offer.service';

export class ExpireOffersJob {
  constructor(private readonly systemPool: Pool, private readonly repo: ListingOfferRepository, private readonly offers: ListingOfferService) {}

  async run(limit = 200): Promise<{ expired: number; failed: number }> {
    const client = await this.systemPool.connect();
    let due: Array<{ id: string; tenantId: string }> = [];
    try {
      await client.query('BEGIN');
      const tx: TxContext = { query: (sql, params) => client.query(sql, params as any) as any, tenantId: '', userId: 'system' };
      due = (await this.repo.findDueToExpire(tx, new Date(), limit)).map((o) => ({ id: o.id, tenantId: o.toProps().tenantId }));
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK').catch(() => undefined); throw e; } finally { client.release(); }

    let expired = 0, failed = 0;
    for (const d of due) { try { await this.offers.expire(d.tenantId, d.id); expired++; } catch { failed++; } }
    return { expired, failed };
  }
}
