// Unit tests for the PURE cart helpers (features/cart/cart-math). No React/native deps (SDK types are type-only).
// The server owns the subtotal; these only derive UI gating state from server fields.
import { cartCount, cartBlockers, canCheckout, clampQuantity, formatAddress } from '../../features/cart/cart-math';
import type { Cart, CartItem, Address } from '@krishi-verse/sdk-js';

const item = (over: Partial<CartItem> = {}): CartItem => ({
  listingId: over.listingId ?? 'l1', title: 'Wheat', quantity: 2, unitPriceMinor: '10000', lineTotalMinor: '20000',
  priceChanged: false, available: 10, purchasable: true, ...over,
});
const cart = (items: CartItem[]): Cart => ({ items, subtotalMinor: '0' });

describe('cartCount', () => {
  it('counts distinct line items; null → 0', () => {
    expect(cartCount(null)).toBe(0);
    expect(cartCount(cart([item(), item({ listingId: 'l2' })]))).toBe(2);
  });
});

describe('cartBlockers', () => {
  it('flags unavailable, insufficient, and price-changed items', () => {
    const c = cart([
      item({ listingId: 'a', purchasable: false }),
      item({ listingId: 'b', quantity: 99, available: 5 }),
      item({ listingId: 'c', priceChanged: true }),
      item({ listingId: 'd' }),
    ]);
    expect(cartBlockers(c)).toEqual([
      { listingId: 'a', reason: 'unavailable' },
      { listingId: 'b', reason: 'insufficient' },
      { listingId: 'c', reason: 'price_changed' },
    ]);
  });
});

describe('canCheckout', () => {
  it('requires a non-empty cart with every item purchasable + in stock', () => {
    expect(canCheckout(null)).toBe(false);
    expect(canCheckout(cart([]))).toBe(false);
    expect(canCheckout(cart([item()]))).toBe(true);
    expect(canCheckout(cart([item({ purchasable: false })]))).toBe(false);
    expect(canCheckout(cart([item({ quantity: 99, available: 5 })]))).toBe(false);
  });
  it('a price change does NOT hard-block checkout (buyer sees the new price)', () => {
    expect(canCheckout(cart([item({ priceChanged: true })]))).toBe(true);
  });
});

describe('clampQuantity', () => {
  it('keeps quantity within [1, available]', () => {
    expect(clampQuantity(2, +1, 10)).toBe(3);
    expect(clampQuantity(1, -1, 10)).toBe(1);
    expect(clampQuantity(10, +1, 10)).toBe(10);
    expect(clampQuantity(5, +1, 0)).toBe(6); // unknown stock (0) → no upper clamp
  });
});

describe('formatAddress', () => {
  it('joins the present parts, skipping empties', () => {
    const a: Address = { id: 'x', line1: '12 Green Rd', line2: '', village: 'Anand', pincode: '388001', isDefault: true };
    expect(formatAddress(a)).toBe('12 Green Rd, Anand, 388001');
  });
});
