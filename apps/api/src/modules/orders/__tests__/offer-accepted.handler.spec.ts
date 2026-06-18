// modules/orders/__tests__/offer-accepted.handler.spec.ts · unit: the offers.offer_accepted → order
// handler. Pure mocks for repo/listing/flags/outbox; asserts the mapping, idempotency, and guards.
import { OfferAcceptedHandler } from '../events/handlers/offer-accepted.handler';
import { OrderEventType } from '../domain/orders.events';

const tenantId = 't1', offerId = 'of1', listingId = 'l1', buyer = 'b1', seller = 's1';
const listing = { sellerUserId: seller, productId: 'p1', title: 'Wheat', unitCode: 'quintal', currencyCode: 'INR', status: 'published' };
const evt = (over: any = {}) => ({ id: '1', tenantId, aggregateType: 'listing_offer', aggregateId: offerId, eventType: 'offers.offer_accepted', payload: { v: 1, offerId, listingId, buyerUserId: buyer, agreedPriceMinor: '90000', quantity: '10', ...over } });

function harness(opts: { exists?: boolean; listing?: any; paymentOn?: boolean } = {}) {
  const repo = { existsForOffer: jest.fn().mockResolvedValue(opts.exists ?? false), insertGraph: jest.fn().mockResolvedValue(undefined) } as any;
  const listings = { getById: jest.fn().mockResolvedValue('listing' in opts ? opts.listing : listing) } as any;
  const flags = { isEnabled: jest.fn().mockResolvedValue(opts.paymentOn ?? false) } as any;
  const outbox = { write: jest.fn().mockResolvedValue(undefined) } as any;
  const metrics = { inc: jest.fn(), timing: jest.fn() } as any;
  const tx = { query: jest.fn() } as any;
  return { h: new OfferAcceptedHandler(repo, listings, flags, outbox, metrics), repo, listings, flags, outbox, tx };
}

describe('OfferAcceptedHandler', () => {
  it('creates an order at the agreed price × qty, source=offer, offer_id set; emits link-back event', async () => {
    const { h, repo, outbox, tx } = harness();
    await h.handle(evt() as any, tx);
    expect(repo.insertGraph).toHaveBeenCalledTimes(1);
    const [, order, items] = repo.insertGraph.mock.calls[0];
    const p = order.toProps();
    expect(p.source).toBe('offer'); expect(p.offerId).toBe(offerId);
    expect(p.buyerUserId).toBe(buyer); expect(p.sellerUserId).toBe(seller);
    expect(p.status).toBe('created');                       // online_payments OFF → COD-style
    expect(items[0].props.unitPriceMinor).toBe(90000n);
    expect(items[0].props.quantity).toBe(10);
    expect(p.subtotalMinor).toBe(900000n);                  // 90000 × 10
    const types = outbox.write.mock.calls.map((c: any[]) => c[1].eventType);
    expect(types).toContain(OrderEventType.Created);
    expect(types).toContain(OrderEventType.FromOfferCreated);
    const link = outbox.write.mock.calls.find((c: any[]) => c[1].eventType === OrderEventType.FromOfferCreated)![1];
    expect(link.payload).toMatchObject({ offerId, orderId: p.id });
  });

  it('online_payments ON → order starts payment_pending', async () => {
    const { h, repo, tx } = harness({ paymentOn: true });
    await h.handle(evt() as any, tx);
    expect(repo.insertGraph.mock.calls[0][1].toProps().status).toBe('payment_pending');
  });

  it('is idempotent — an existing order for the offer means no second order', async () => {
    const { h, repo, tx } = harness({ exists: true });
    await h.handle(evt() as any, tx);
    expect(repo.insertGraph).not.toHaveBeenCalled();
  });

  it('ignores a malformed payload and a vanished listing (no order, no throw)', async () => {
    const a = harness();
    await a.h.handle(evt({ buyerUserId: undefined }) as any, a.tx);
    expect(a.repo.insertGraph).not.toHaveBeenCalled();
    const b = harness({ listing: null });
    await b.h.handle(evt() as any, b.tx);
    expect(b.repo.insertGraph).not.toHaveBeenCalled();
  });

  it('refuses a self-deal (buyer === seller) defensively', async () => {
    const { h, repo, tx } = harness({ listing: { ...listing, sellerUserId: buyer } });
    await h.handle(evt() as any, tx);
    expect(repo.insertGraph).not.toHaveBeenCalled();
  });
});
