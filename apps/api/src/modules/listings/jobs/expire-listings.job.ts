// modules/listings/jobs/expire-listings.job.ts
// Periodic job: move past-expiry active listings to 'expired'. Runs in the worker
// service, NOT the API. Uses FOR UPDATE SKIP LOCKED batching so many worker pods
// can run concurrently at billion-row scale without contending on the same rows.
import { Inject, Injectable, Logger } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { METRICS, Metrics } from '../../../core/observability/metrics';
import { ListingRepository } from '../repositories/listing.repository';

const BATCH = 500;

@Injectable()
export class ExpireListingsJob {
  private readonly log = new Logger(ExpireListingsJob.name);
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly repo: ListingRepository,
  ) {}

  /** Process one tenant shard's due listings; returns count expired this pass. */
  async runForTenant(tenantId: string, now = new Date()): Promise<number> {
    let total = 0;
    for (;;) {
      const expired = await this.uow.run(tenantId, async (tx) => {
        const due = await this.repo.findDueForExpiry(tx, tenantId, now, BATCH); // FOR UPDATE SKIP LOCKED
        for (const listing of due) {
          listing.expire();
          await this.repo.update(tx, listing);
          for (const e of listing.pullEvents()) {
            await this.outbox.write(tx, { tenantId, aggregateType: 'listing', aggregateId: listing.id, eventType: e.type, payload: { v: 1, ...e } });
          }
        }
        return due.length;
      });
      total += expired;
      if (expired < BATCH) break; // drained
    }
    if (total) this.metrics.inc('listing.expired', { tenant: tenantId }, total);
    return total;
  }
}
