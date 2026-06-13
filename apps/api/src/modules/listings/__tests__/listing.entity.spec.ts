// modules/listings/__tests__/listing.entity.spec.ts
// Pure unit tests for the aggregate's business invariants. No DB, no framework.
import { Listing, ListingProps } from '../domain/listing.entity';
import { InsufficientStockError, InvalidPriceError, ListingNotEditableError } from '../domain/listing.errors';

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
});
