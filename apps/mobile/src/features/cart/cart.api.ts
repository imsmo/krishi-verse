// apps/mobile/src/features/cart/cart.api.ts · data layer for the buyer cart + checkout (P-09). Keeps screens thin
// (guide §3). The cart is the SERVER's truth (prices/availability recomputed live, Law 2 bigint-minor); reads
// degrade-never-die (empty cart on failure). Mutations return {ok} → the caller re-reads the cart. Checkout is a
// REAL, idempotent (Law 3) cart→orders conversion — NOT offline-queued (it needs live stock/price/coupon
// validation and an immediate result); it throws so the screen shows the precise outcome (409 stale, 422 invalid).
import type { Cart, CheckoutResult } from '@krishi-verse/sdk-js';
import { apiClient } from '../../core/api/client';
import { newId } from '../../core/util/ids';

const EMPTY: Cart = { items: [], subtotalMinor: '0' };

export async function getCart(): Promise<Cart> {
  try { return await apiClient().cart.get(); } catch { return EMPTY; }
}
export async function addToCart(listingId: string, quantity: number): Promise<boolean> {
  try { return (await apiClient().cart.addItem(listingId, quantity)).ok; } catch { return false; }
}
export async function setCartQuantity(listingId: string, quantity: number): Promise<Cart> {
  try { await apiClient().cart.updateItem(listingId, quantity); } catch { /* degrade — re-read below */ }
  return getCart();
}
export async function removeFromCart(listingId: string): Promise<Cart> {
  try { await apiClient().cart.removeItem(listingId); } catch { /* degrade */ }
  return getCart();
}
export async function clearCart(): Promise<Cart> {
  try { await apiClient().cart.clear(); } catch { /* degrade */ }
  return getCart();
}

/** Place the order: convert the cart into orders (idempotent). Throws on a real error so checkout can show it. */
export function placeOrder(input: { deliveryAddressId?: string; couponCode?: string }): Promise<CheckoutResult> {
  return apiClient().checkout.checkout(input, newId());
}
