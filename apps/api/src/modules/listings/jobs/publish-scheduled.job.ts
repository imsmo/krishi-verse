// modules/listings/jobs/publish-scheduled.job.ts
// Periodic job: publish listings whose publishAt time has arrived (scheduled drops).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { ListingRepository } from '../repositories/listing.repository';

const BATCH = 500;

@Injectable()
export class PublishScheduledJob {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    private readonly repo: ListingRepository,
  ) {}
  async runForTenant(tenantId: string, now = new Date()): Promise<number> {
    let total = 0;
    for (;;) {
      const n = await this.uow.run(tenantId, async (tx) => {
        const due = await this.repo.findDueForPublish(tx, tenantId, now, BATCH);
        for (const listing of due) {
          listing.publish();
          await this.repo.update(tx, listing);
          for (const e of listing.pullEvents()) {
            await this.outbox.write(tx, { tenantId, aggregateType: 'listing', aggregateId: listing.id, eventType: e.type, payload: { v: 1, ...e } });
          }
        }
        return due.length;
      });
      total += n;
      if (n < BATCH) break;
    }
    return total;
  }
}
