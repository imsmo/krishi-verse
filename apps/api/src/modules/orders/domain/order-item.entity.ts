// modules/orders/domain/order-item.entity.ts · a frozen line of an order (snapshot of what the
// buyer saw). Money is bigint minor units; line total computed in bigint (no float).
import { lineTotalMinor } from './orders.events';
import { InvalidQuantityError } from './orders.errors';

export interface OrderItemProps {
  id: string; orderId: string; orderCreatedAt: Date; tenantId: string; listingId: string; productId: string;
  titleSnapshot: string; quantity: number; deliveredQuantity: number | null; unitCode: string;
  unitPriceMinor: bigint; lineTotalMinor: bigint; gstRatePct: number | null; hsnCode: string | null; batchId: string | null;
}
export class OrderItem {
  constructor(readonly props: OrderItemProps) {}
  static of(input: Omit<OrderItemProps, 'lineTotalMinor' | 'deliveredQuantity'>): OrderItem {
    if (input.quantity <= 0) throw new InvalidQuantityError();
    return new OrderItem({ ...input, deliveredQuantity: null, lineTotalMinor: lineTotalMinor(input.unitPriceMinor, input.quantity) });
  }
}
