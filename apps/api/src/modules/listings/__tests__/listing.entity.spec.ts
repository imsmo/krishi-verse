// modules/listings/__tests__/listing.entity.spec.ts
// Pure unit tests for the aggregate's business invariants. No DB, no framework.
import { Listing, ListingProps } from '../domain/listing.entity';
import { InsufficientStockError, InvalidPriceError, ListingNotEditableError, InvalidRepostDurationError } from '../domain/listing.errors';
import { IllegalListingTransitionError } from '../domain/listing.errors';

const baseCreate = {
  id: 'L1', tenantId: 't1', sellerUserId: 'u1', productId: 'p1', categoryId: 'c1',
  title: 'Wheat 50 quintal', description: null,
  quantityTotal: 50, minOrderQty: 1, unitCode: 'quintal',
  priceMinor: 1_440_000n, currencyCode: 'INR',
  organicClaim: 'none' as const, saleType: 'direct' as const,
  pincode: '362001', regionId: 'r1', lat: null, lng: null,
  visibility: 'public' as const, aiExtracted: false, publishAt: null, publishedAt: null, expiresAt: null,
};

describe('Listing aggregate', () => {
  it('create() defaults quantityAvailable to total, status draft, emits created event', () => {
    const l = Listing.create({ ...baseCreate });
    expect(l.quantityAvailable).toBe(50);
    expect(l.status).toBe('draft');
    expect(l.pullEvents().map((e) => e.type)).toContain('listing.created');
  });

  it('rejects non-positive price and quantity', () => {
    expect(() => Listing.create({ ...baseCreate, priceMinor: 0n })).toThrow(InvalidPriceError);
    expect(() => Listing.create({ ...baseCreate, quantityTotal: 0 })).toThrow(InvalidPriceError);
  });

  it('publish() moves draft→published, stamps publishedAt, emits published event', () => {
    const l = Listing.create({ ...baseCreate });
    l.pullEvents();
    l.publish(new Date('2026-01-01T00:00:00Z'));
    expect(l.status).toBe('published');
    expect(l.toProps().publishedAt).toEqual(new Date('2026-01-01T00:00:00Z'));
    expect(l.pullEvents().map((e) => e.type)).toContain('listing.published');
  });

  it('reduceStock() prevents oversell and auto-sells-out at zero', () => {
    const l = Listing.create({ ...baseCreate, quantityTotal: 10 });
    l.publish(); l.pullEvents();
    expect(() => l.reduceStock(11)).toThrow(InsufficientStockError);
    l.reduceStock(10);
    expect(l.quantityAvailable).toBe(0);
    expect(l.status).toBe('sold_out');
    expect(l.pullEvents().map((e) => e.type)).toContain('listing.sold_out');
  });

  it('restock() re-publishes a sold-out listing and never exceeds total', () => {
    const l = Listing.create({ ...baseCreate, quantityTotal: 5 });
    l.publish(); l.reduceStock(5); l.pullEvents();
    l.restock(99);
    expect(l.quantityAvailable).toBe(5);
    expect(l.status).toBe('published');
  });

  it('changePrice() is a no-op (no event) when price is unchanged', () => {
    const l = Listing.create({ ...baseCreate }); l.publish(); l.pullEvents();
    l.changePrice(1_440_000n);
    expect(l.pullEvents()).toHaveLength(0);
  });

  it('changePrice() forbidden in non-editable state', () => {
    const l = Listing.create({ ...baseCreate }); l.publish(); l.reduceStock(50); // sold_out
    expect(() => l.changePrice(999n)).toThrow(ListingNotEditableError);
  });

  it('repost() brings an EXPIRED listing back to published with a fresh expiry window', () => {
    const l = Listing.create({ ...baseCreate }); l.publish(); l.expire(); l.pullEvents();
    const now = new Date('2026-06-30T00:00:00Z');
    l.repost(7, now);
    expect(l.status).toBe('published');
    const p = l.toProps();
    expect(p.publishedAt).toEqual(now);
    expect(p.expiresAt).toEqual(new Date('2026-07-07T00:00:00Z')); // +7 days, not the stale past expiry
    expect(l.pullEvents().map((e) => e.type)).toContain('listing.published');
  });

  it('repost() can update the price atomically and emits price_changed', () => {
    const l = Listing.create({ ...baseCreate }); l.publish(); l.expire(); l.pullEvents();
    l.repost(7, new Date('2026-06-30T00:00:00Z'), 1_460_000n);
    expect(l.toProps().priceMinor).toBe(1_460_000n);
    expect(l.pullEvents().map((e) => e.type)).toContain('listing.price_changed');
  });

  it('repost() rejects an invalid duration and a non-positive price', () => {
    const mk = () => { const l = Listing.create({ ...baseCreate }); l.publish(); l.expire(); return l; };
    expect(() => mk().repost(0)).toThrow(InvalidRepostDurationError);
    expect(() => mk().repost(61)).toThrow(InvalidRepostDurationError);
    expect(() => mk().repost(7, new Date(), 0n)).toThrow(InvalidPriceError);
  });

  it('repost() refuses an illegal source state (e.g. a live published listing)', () => {
    const l = Listing.create({ ...baseCreate }); l.publish(); // published → published is illegal
    expect(() => l.repost(7)).toThrow(IllegalListingTransitionError);
  });
});
