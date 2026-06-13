// modules/listings/jobs/boost-expiry.job.ts
// Periodic job: end boosts whose endsAt has passed and emit an event so the search
// indexer drops the boost_rank. Batched + SKIP LOCKED, worker-driven.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { ListingBoostRepository } from '../repositories/listing-boost.repository';

const BATCH = 500;

@Injectable()
export class BoostExpiryJob {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    private readonly repo: ListingBoostRepository,
  ) {}
  async runForTenant(tenantId: string, now = new Date()): Promise<number> {
    let total = 0;
    for (;;) {
      const n = await this.uow.run(tenantId, async (tx) => {
        const due = await this.repo.findExpired(tx, tenantId, now, BATCH);
        for (const b of due) {
          await this.repo.markEnded(tx, tenantId, b.id);
          await this.outbox.write(tx, { tenantId, aggregateType: 'listing', aggregateId: b.listingId,
            eventType: 'listing.boost_ended', payload: { v: 1, listingId: b.listingId } });
        }
        return due.length;
      });
      total += n;
      if (n < BATCH) break;
    }
    return total;
  }
}
