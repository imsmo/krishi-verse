// modules/orders/__tests__/dispute-resolution.spec.ts · unit: Order.applyDisputeResolution maps a
// dispute outcome onto the order via legal state-machine edges, and is idempotent.
import { Order } from '../domain/order.entity';
import { OrderItem } from '../domain/order-item.entity';
import { OrderEventType } from '../domain/orders.events';

const SELLER = 'seller1', BUYER = 'buyer1';
const disputed = () => {
  const o = Order.place({ id: 'o1', tenantId: 't1', orderNo: 'KV-1', checkoutGroupId: null, buyerUserId: BUYER, sellerUserId: SELLER,
    source: 'direct', currencyCode: 'INR',
    items: [OrderItem.of({ id: 'i1', orderId: 'o1', orderCreatedAt: new Date(), tenantId: 't1', listingId: 'l1', productId: 'p1', titleSnapshot: 'X', quantity: 1, unitCode: 'quintal', unitPriceMinor: 1000n, gstRatePct: null, hsnCode: null, batchId: null })],
    deliveryMethodId: null, deliveryAddressId: null, requiresPayment: false });
  o.confirm(SELLER); o.dispute(BUYER); o.pullEvents();
  return o;
};

describe('Order.applyDisputeResolution', () => {
  it('refund_full → refunded', () => { const o = disputed(); expect(o.applyDisputeResolution('refund_full')).toBe(true); expect(o.status).toBe('refunded'); });
  it('refund_partial → partially_refunded', () => { const o = disputed(); o.applyDisputeResolution('refund_partial'); expect(o.status).toBe('partially_refunded'); });
  it('rejected → completed (release to seller) and emits order_completed', () => {
    const o = disputed(); expect(o.applyDisputeResolution('rejected')).toBe(true);
    expect(o.status).toBe('completed');
    expect(o.pullEvents().map((e) => e.type)).toContain(OrderEventType.Completed);
  });
  it('is a no-op (false) when the order is not disputed', () => {
    const o = Order.place({ id: 'o2', tenantId: 't1', orderNo: 'KV-2', checkoutGroupId: null, buyerUserId: BUYER, sellerUserId: SELLER, source: 'direct', currencyCode: 'INR', items: [OrderItem.of({ id: 'i', orderId: 'o2', orderCreatedAt: new Date(), tenantId: 't1', listingId: 'l', productId: 'p', titleSnapshot: 'X', quantity: 1, unitCode: 'quintal', unitPriceMinor: 1000n, gstRatePct: null, hsnCode: null, batchId: null })], deliveryMethodId: null, deliveryAddressId: null, requiresPayment: false });
    expect(o.applyDisputeResolution('refund_full')).toBe(false);
    expect(o.status).toBe('created');
  });
});
