// @krishi-verse/sdk-js · cart + checkout resources (module 3). The cart is owner-scoped server-side; mutations
// return { ok } so the caller re-reads the authoritative cart (prices/availability are recomputed live — the
// client never trusts a stale line total). Checkout converts the cart into orders under ONE Idempotency-Key
// (Law 3) so a retried "place order" can't double-create. Money is bigint minor-unit strings (Law 2); the final
// charges/discount/tax are computed SERVER-SIDE and read back on the order.
import { HttpClient } from '../http';
import { Cart, CheckoutResult } from '../types';

export class CartResource {
  constructor(private readonly http: HttpClient) {}
  async get(signal?: AbortSignal): Promise<Cart> { return (await this.http.request<Cart>('GET', 'cart', { signal })).data; }
  async addItem(listingId: string, quantity: number): Promise<{ ok: boolean }> {
    return (await this.http.request<{ ok: boolean }>('POST', 'cart/items', { body: { listingId, quantity } })).data;
  }
  async updateItem(listingId: string, quantity: number): Promise<{ ok: boolean }> {
    return (await this.http.request<{ ok: boolean }>('PATCH', `cart/items/${encodeURIComponent(listingId)}`, { body: { quantity } })).data;
  }
  async removeItem(listingId: string): Promise<{ ok: boolean }> {
    return (await this.http.request<{ ok: boolean }>('DELETE', `cart/items/${encodeURIComponent(listingId)}`)).data;
  }
  async clear(): Promise<{ ok: boolean }> { return (await this.http.request<{ ok: boolean }>('DELETE', 'cart')).data; }
}

export class CheckoutResource {
  constructor(private readonly http: HttpClient) {}
  /** Convert the active cart into orders. Idempotency-keyed (Law 3). `couponCode` is validated + redeemed
   * SERVER-SIDE against the primary order (the client never computes the discount). */
  async checkout(input: { deliveryAddressId?: string; deliveryMethodId?: string; couponCode?: string }, idempotencyKey: string): Promise<CheckoutResult> {
    return (await this.http.request<CheckoutResult>('POST', 'checkout', { idempotencyKey, body: input })).data;
  }
}
