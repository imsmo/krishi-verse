// modules/orders/events/handlers/shipment-delivered.handler.ts
// Consumes logistics.shipment_delivered (delivered by the outbox relay). The carrier confirmed
// physical delivery → advance the order to 'delivered' (walking the legal state-machine edges) and
// open the quality/dispute window; later jobs/handlers complete it (→ escrow settlement). Runs INSIDE
// the relay tx. IDEMPOTENT: recordCarrierDelivery is a no-op if the order is already delivered/
// completed (or not in a deliverable state), so re-delivery does nothing.
import { Inject, Injectable } from '@nestjs/common';
import { OUTBOX_WRITER, OutboxWriter } from '../../../../core/outbox/outbox.writer';
import { OutboxEvent, OutboxHandler } from '../../../../core/outbox/event-envelope';
import { TxContext } from '../../../../core/database/unit-of-work';
import { OrderRepository } from '../../repositories/order.repository';

@Injectable()
export class ShipmentDeliveredHandler implements OutboxHandler {
  readonly eventType = 'logistics.shipment_delivered';
  constructor(private readonly repo: OrderRepository, @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter) {}

  async handle(event: OutboxEvent, tx: TxContext): Promise<void> {
    const tenantId = event.tenantId;
    const orderId = event.payload.orderId as string | undefined;
    if (!tenantId || !orderId) return;

    const order = await this.repo.getForUpdate(tx, tenantId, orderId);
    if (!order) return;
    const from = order.status;
    if (!order.recordCarrierDelivery()) return;            // idempotent / not applicable
    await this.repo.update(tx, order, from);
    for (const e of order.pullEvents()) {
      await this.outbox.write(tx, { tenantId, aggregateType: 'order', aggregateId: orderId, eventType: e.type, payload: { v: 1, ...e.payload } });
    }
  }
}
