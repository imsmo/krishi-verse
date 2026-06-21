// apps/mobile/src/features/cart/cart-math.ts · PURE cart helpers (no React/native; SDK types are `import type` →
// erased) → unit-tested. The cart's authoritative subtotal + line totals come from the SERVER (prices recomputed
// live); these helpers only derive UI state (item count, checkout blockers). Money is bigint minor-unit strings
// (Law 2) — never summed as a float here (the server owns the subtotal).
import type { CartItem, Cart, Address } from '@krishi-verse/sdk-js';

/** Total distinct line items (for the cart-tab badge). */
export function cartCount(cart: Cart | null): number {
  return cart?.items.length ?? 0;
}

export type CartBlocker = { listingId: string; reason: 'unavailable' | 'insufficient' | 'price_changed' };

/** Per-item issues that must be surfaced before checkout: an item gone unpurchasable, a quantity above what's
 * available, or a price that moved since it was added (the buyer must re-confirm). Derived from server fields. */
export function cartBlockers(cart: Cart | null): CartBlocker[] {
  const out: CartBlocker[] = [];
  for (const it of cart?.items ?? []) {
    if (!it.purchasable) out.push({ listingId: it.listingId, reason: 'unavailable' });
    else if (it.quantity > it.available) out.push({ listingId: it.listingId, reason: 'insufficient' });
    else if (it.priceChanged) out.push({ listingId: it.listingId, reason: 'price_changed' });
  }
  return out;
}

/** Checkout is allowed only when the cart is non-empty and every item is purchasable + within stock. A
 * price_changed item does NOT hard-block (the buyer sees the new price), but unavailable/insufficient do. The
 * SERVER re-validates at checkout regardless — this is UX gating only. */
export function canCheckout(cart: Cart | null): boolean {
  if (!cart || cart.items.length === 0) return false;
  return cart.items.every((it) => it.purchasable && it.quantity <= it.available);
}

/** Step a cart quantity by ±1 within [1, available]; pure so the screen's +/- buttons are predictable. */
export function clampQuantity(current: number, delta: number, available: number): number {
  const next = current + delta;
  if (next < 1) return 1;
  if (available > 0 && next > available) return available;
  return next;
}

/** One-line, PII-light address label for pickers/summaries. Never dumps the contact phone unless present + asked. */
export function formatAddress(a: Address): string {
  const parts = [a.line1, a.line2, a.village, a.pincode].filter((p): p is string => !!p && p.trim().length > 0);
  return parts.join(', ');
}
