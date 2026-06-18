// modules/orders/__tests__/carrier-delivery.spec.ts · unit: Order.recordCarrierDelivery walks the
// LEGAL state-machine edges to 'delivered' (logistics-driven fulfilment) and is idempotent.
import { Order } from '../domain/order.entity';
import { OrderItem } from '../domain/order-item.entity';
import { OrderEventType } from '../domain/orders.events';

const SELLER = 'seller1', BUYER = 'buyer1';
const place = () => Order.place({
  id: 'o1', tenantId: 't1', orderNo: 'KV-1', checkoutGroupId: null, buyerUserId: BUYER, sellerUserId: SELLER,
  source: 'direct', currencyCode: 'INR',
  items: [OrderItem.of({ id: 'i1', orderId: 'o1', orderCreatedAt: new Date(), tenantId: 't1', listingId: 'l1', productId: 'p1', titleSnapshot: 'X', quantity: 1, unitCode: 'quintal', unitPriceMinor: 1000n, gstRatePct: null, hsnCode: null, batchId: null })],
  deliveryMethodId: null, deliveryAddressId: null, requiresPayment: false,
});

describe('Order.recordCarrierDelivery', () => {
  it('walks confirmed → … → delivered via legal edges and opens the quality window', () => {
    const o = place(); o.confirm(SELLER); o.pullEvents();
    expect(o.recordCarrierDelivery()).toBe(true);
    expect(o.status).toBe('delivered');
    expect(o.toProps().qualityWindowEnds).toBeInstanceOf(Date);
    const types = o.pullEvents().map((e) => e.type);
    expect(types).toContain(OrderEventType.Delivered);
  });
  it('delivers from out_for_delivery directly', () => {
    const o = place(); o.confirm(SELLER); o.markPacked(SELLER); o.markReady(SELLER);
    // ready is pre-dispatch; recordCarrierDelivery should still reach delivered
    expect(o.recordCarrierDelivery()).toBe(true);
    expect(o.status).toBe('delivered');
  });
  it('is idempotent: a second call is a no-op (returns false)', () => {
    const o = place(); o.confirm(SELLER); o.recordCarrierDelivery();
    expect(o.recordCarrierDelivery()).toBe(false);
    expect(o.status).toBe('delivered');
  });
  it('ignores non-deliverable states (cancelled) without throwing', () => {
    const o = place(); o.cancel(BUYER, null, true);
    expect(o.recordCarrierDelivery()).toBe(false);
    expect(o.status).toBe('cancelled');
  });
});
