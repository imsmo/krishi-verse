// modules/orders/jobs/seller-confirm-timeout.job.ts · worker job: auto-cancel orders the seller
// never confirmed within the acceptance window (PRD §7.4). Batched + FOR UPDATE SKIP LOCKED so
// many worker pods run concurrently at scale. Emits events via the outbox.
import { Inject, Injectable, Logger } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { OrderRepository } from '../repositories/order.repository';

const BATCH = 200;
@Injectable()
export class SellerConfirmTimeoutJob {
  private readonly log = new Logger(SellerConfirmTimeoutJob.name);
  constructor(@Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork, @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter, private readonly repo: OrderRepository) {}
  async runForTenant(tenantId: string, now = new Date()): Promise<number> {
    let total = 0;
    for (;;) {
      const n = await this.uow.run(tenantId, async (tx) => {
        const due = await this.repo.findDue(tx, tenantId, ['created', 'payment_pending'], 'acceptance_deadline', now, BATCH);
        for (const order of due) {
          const from = order.toProps().status;
          order.systemCancel('seller_confirm_timeout');
          await this.repo.update(tx, order, from);
          for (const e of order.pullEvents()) await this.outbox.write(tx, { tenantId, aggregateType: 'order', aggregateId: order.id, eventType: e.type, payload: { v: 1, reason: 'seller_confirm_timeout', ...e.payload } });
        }
        return due.length;
      });
      total += n; if (n < BATCH) break;
    }
    if (total) this.log.log(`auto-cancelled ${total} unconfirmed orders for tenant ${tenantId}`);
    return total;
  }
}
