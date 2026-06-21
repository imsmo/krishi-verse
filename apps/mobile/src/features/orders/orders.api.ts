// apps/mobile/src/features/orders/orders.api.ts · data layer for the farmer orders + delivery vertical (P-07).
// Keeps screens thin (guide §3). Reads serve through the SWR cache (usable offline) and degrade-never-die (empty/
// null on hard failure). Money is bigint-minor strings (Law 2). Mutations are LIFECYCLE TRANSITIONS, not blind
// writes: they are NOT offline-queued — a transition (confirm/deliver/complete) needs the server's live state to
// be legal, and blind replay of a stale transition is wrong; so they run online, idempotent (Law 3 key), and the
// caller surfaces the precise server outcome (409 = already moved, 403 = not allowed). PoD captures the buyer OTP
// + an uploaded photo and delivers the shipment server-side.
import type { OrderListItem, OrderDetail, OrderRole, Shipment } from '@krishi-verse/sdk-js';
import { apiClient } from '../../core/api/client';
import { cache } from '../../core/offline/sqlite.db';
import { currentScope } from '../../core/offline/scope';
import { POLICY } from '../../core/offline/cache-policies';
import { newId } from '../../core/util/ids';

export interface OrdersPage { items: OrderListItem[]; nextCursor: string | null }

/** Orders as buyer or seller (optionally status-filtered). Read-through SWR cache; degrades to an empty page. */
export async function listOrders(params: { role: OrderRole; status?: string; cursor?: string; limit?: number }): Promise<OrdersPage> {
  try {
    const { value } = await cache.read<OrdersPage>({
      scope: currentScope(), ns: 'orders.list', parts: [params.role, params.status ?? 'all', params.cursor ?? 'first', params.limit ?? 20], policy: POLICY.shortList,
      fetcher: () => apiClient().orders.list(params),
    });
    return value;
  } catch { return { items: [], nextCursor: null }; }
}

/** One order's full detail (items + money breakdown). Degrades to null → the screen shows a retry. */
export async function getOrder(id: string): Promise<OrderDetail | null> {
  try { return await apiClient().orders.get(id); } catch { return null; }
}

// --- lifecycle transitions (online, idempotent; throw so the screen can show the precise outcome) ---
export function confirmOrder(id: string): Promise<{ ok: boolean }> { return apiClient().orders.confirm(id, newId()); }
export function packOrder(id: string): Promise<{ ok: boolean }> { return apiClient().orders.markPacked(id, newId()); }
export function readyOrder(id: string): Promise<{ ok: boolean }> { return apiClient().orders.markReady(id, newId()); }
export function markOrderDelivered(id: string): Promise<{ ok: boolean }> { return apiClient().orders.markDelivered(id, newId()); }
export function completeOrder(id: string): Promise<{ ok: boolean }> { return apiClient().orders.complete(id, newId()); }
export function cancelOrder(id: string, reasonId?: string): Promise<{ ok: boolean }> { return apiClient().orders.cancel(id, newId(), reasonId); }
/** Report a problem with an order → opens a dispute case server-side (free-text note). */
export function reportOrder(id: string, note: string): Promise<{ ok: boolean }> { return apiClient().orders.dispute(id, note, newId()); }

// --- shipment / proof-of-delivery ---
/** The shipment for an order (the caller's assigned one). null when none / not visible to this user. */
export async function getOrderShipment(orderId: string): Promise<Shipment | null> {
  try { const page = await apiClient().shipments.list({ box: 'mine', orderId, limit: 1 }); return page.items[0] ?? null; }
  catch { return null; }
}
/** Record proof-of-delivery: buyer OTP (+ optional uploaded photo mediaId) → deliver the shipment. Idempotent. */
export function recordPod(shipmentId: string, otp: string, podMediaId?: string): Promise<Shipment> {
  return apiClient().shipments.deliver(shipmentId, { otp: otp.trim(), podMediaId }, newId());
}
