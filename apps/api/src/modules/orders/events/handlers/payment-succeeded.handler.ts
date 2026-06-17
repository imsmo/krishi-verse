// modules/orders/events/handlers/payment-succeeded.handler.ts
// Consumes payments.payment_succeeded (delivered by the outbox relay). When the paid order was
// awaiting payment, advance it to confirmed (Order.markPaid). IDEMPOTENT: markPaid is a no-op
// unless the order is in payment_pending, so a re-delivery does nothing. Runs inside the relay tx.
import { Inject, Injectable } from '@nestjs/common';
import { OUTBOX_WRITER, OutboxWriter } from '../../../../core/outbox/outbox.writer';
import { OutboxEvent, OutboxHandler } from '../../../../core/outbox/event-envelope';
import { TxContext } from '../../../../core/database/unit-of-work';
import { OrderRepository } from '../../repositories/order.repository';

@Injectable()
export class PaymentSucceededHandler implements OutboxHandler {
  readonly eventType = 'payments.payment_succeeded';
  constructor(private readonly repo: OrderRepository, @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter) {}

  async handle(event: OutboxEvent, tx: TxContext): Promise<void> {
    if (event.payload.referenceType !== 'order') return;            // not an order payment
    const tenantId = event.tenantId;
    const orderId = event.payload.referenceId as string;
    if (!tenantId || !orderId) return;

    const order = await this.repo.getForUpdate(tx, tenantId, orderId);
    if (!order) return;                                              // unknown / already gone
    const from = order.status;
    order.markPaid();                                               // payment_pending → confirmed
    if (order.status === from) return;                             // idempotent: nothing to do
    await this.repo.update(tx, order, from);
    for (const e of order.pullEvents()) {
      await this.outbox.write(tx, { tenantId, aggregateType: 'order', aggregateId: orderId, eventType: e.type, payload: { v: 1, ...e.payload } });
    }
  }
}
