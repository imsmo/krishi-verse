// modules/orders/services/order-item.service.ts
// Read + partial-fulfilment use-cases for an order's frozen line items. Listing an order's items is
// visibility-checked through OrderRepository.getVisible (buyer / seller / moderator — else 404, no
// enumeration). Recording DELIVERED quantity (PRD §9.6) is a SELLER-or-moderator action while the order
// is out-for-delivery/delivered: one ACID tx (UoW), bounded to the ordered quantity, with the event
// emitted via OrdersPublisher in the SAME tx (Law 4). NO money moves here.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../core/database/unit-of-work';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { OrderRepository } from '../repositories/order.repository';
import { OrderItemRepository } from '../repositories/order-item.repository';
import { OrdersPublisher } from '../events/orders.publisher';
import { OrderNotFoundError, OrderForbiddenError, InvalidQuantityError } from '../domain/orders.errors';

export interface OrdersActor { userId: string; canModerate: boolean; }

@Injectable()
export class OrderItemService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly orders: OrderRepository,
    private readonly items: OrderItemRepository,
    private readonly publisher: OrdersPublisher,
  ) {}

  /** An order's frozen line items, visible to the buyer/seller/moderator only (404 otherwise). */
  async listForOrder(tenantId: string, actor: OrdersActor, orderId: string) {
    const order = await this.orders.getVisible(tenantId, orderId, actor.userId, actor.canModerate);
    if (!order) throw new OrderNotFoundError(orderId);
    const items = await this.items.listByOrder(tenantId, orderId);
    return { orderId, items };
  }

  /** Seller (or moderator) records how much of a line actually arrived (partial fulfilment). */
  async recordDelivered(tenantId: string, actor: OrdersActor, orderId: string, listingId: string, deliveredQuantity: number) {
    if (deliveredQuantity < 0) throw new InvalidQuantityError();
    return timed(this.metrics, 'orders.record_delivered', { tenant: tenantId }, () =>
      this.uow.run(tenantId, async (tx) => {
        const order = await this.orders.getForUpdate(tx, tenantId, orderId);
        if (!order) throw new OrderNotFoundError(orderId);
        if (!actor.canModerate && order.sellerUserId !== actor.userId) throw new OrderForbiddenError('only the seller may record delivery');
        if (order.status !== 'out_for_delivery' && order.status !== 'delivered') throw new OrderForbiddenError(`cannot record delivery while order is ${order.status}`);
        const lines = await this.items.forUpdate(tx, tenantId, orderId);
        const line = lines.find((l) => l.listingId === listingId);
        if (!line) throw new OrderNotFoundError(`${orderId}/${listingId}`);
        if (deliveredQuantity > Number(line.quantity)) throw new InvalidQuantityError();   // can't deliver more than ordered
        await this.items.recordDelivered(tx, tenantId, orderId, listingId, deliveredQuantity);
        await this.publisher.itemDelivered(tx, tenantId, orderId, listingId, deliveredQuantity);
        return { ok: true, orderId, listingId, deliveredQuantity };
      }, { userId: actor.userId }));
  }
}
