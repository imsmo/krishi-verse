// modules/orders/domain/orders.events.ts · integration events (via outbox).
export const OrderEventType = {
  Created: 'orders.order_created',
  PaymentRequired: 'orders.payment_required',
  Confirmed: 'orders.order_confirmed',
  Cancelled: 'orders.order_cancelled',
  Packed: 'orders.order_packed',
  Ready: 'orders.order_ready',
  OutForDelivery: 'orders.order_out_for_delivery',
  Delivered: 'orders.order_delivered',
  Completed: 'orders.order_completed',
  Disputed: 'orders.order_disputed',
  FromOfferCreated: 'orders.order_from_offer_created',   // an accepted offer became this order (→ offers links back)
  StatusChanged: 'orders.order_status_changed',
} as const;
export type OrderEventType = typeof OrderEventType[keyof typeof OrderEventType];
export type DomainEvent = { type: string; payload: Record<string, unknown> };

/** Money math in bigint minor units. qty has ≤3 decimals (numeric(14,3)). Floors to the paisa. */
export function lineTotalMinor(unitPriceMinor: bigint, qty: number): bigint {
  const qtyMilli = BigInt(Math.round(qty * 1000));
  return (unitPriceMinor * qtyMilli) / 1000n;
}
