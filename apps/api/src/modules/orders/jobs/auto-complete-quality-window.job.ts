// modules/orders/jobs/auto-complete-quality-window.job.ts · worker job: auto-complete delivered
// orders once the dispute/quality window has closed with no dispute (releases the sale).
import { Inject, Injectable, Logger } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { OrderRepository } from '../repositories/order.repository';

const BATCH = 200;
@Injectable()
export class AutoCompleteQualityWindowJob {
  private readonly log = new Logger(AutoCompleteQualityWindowJob.name);
  constructor(@Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork, @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter, private readonly repo: OrderRepository) {}
  async runForTenant(tenantId: string, now = new Date()): Promise<number> {
    let total = 0;
    for (;;) {
      const n = await this.uow.run(tenantId, async (tx) => {
        const due = await this.repo.findDue(tx, tenantId, ['delivered'], 'quality_window_ends', now, BATCH);
        for (const order of due) {
          const from = order.toProps().status;
          order.complete(now);
          await this.repo.update(tx, order, from);
          for (const e of order.pullEvents()) await this.outbox.write(tx, { tenantId, aggregateType: 'order', aggregateId: order.id, eventType: e.type, payload: { v: 1, reason: 'quality_window_closed', ...e.payload } });
        }
        return due.length;
      });
      total += n; if (n < BATCH) break;
    }
    if (total) this.log.log(`auto-completed ${total} delivered orders for tenant ${tenantId}`);
    return total;
  }
}
