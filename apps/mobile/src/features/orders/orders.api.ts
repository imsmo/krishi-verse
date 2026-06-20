// apps/mobile/src/features/orders/orders.api.ts · data layer for the farmer's orders (seller box). Keeps the
// screen thin (guide §3). Keyset pagination only; degrade-never-die (empty on failure). Money is bigint-minor.
// Assumed contract: GET /v1/orders?box=seller&cursor=&limit= → { data: OrderRow[], meta:{ nextCursor } }
// (orders module). Replace with a typed SDK `orders` resource when added (roadmap P-07).
import { apiClient } from '../../core/api/client';
import { cache } from '../../core/offline/sqlite.db';
import { currentScope } from '../../core/offline/scope';
import { POLICY } from '../../core/offline/cache-policies';

export interface OrderRow { id: string; status: string; totalMinor: string; currencyCode: string }
type OrdersPage = { items: OrderRow[]; nextCursor: string | null };

/** Seller orders, read-through SWR cache (usable offline); degrades to an empty page on a hard failure. */
export async function sellerOrders(cursor?: string, limit = 30): Promise<OrdersPage> {
  try {
    const { value } = await cache.read<OrdersPage>({
      scope: currentScope(), ns: 'orders.seller', parts: [cursor ?? 'first', limit], policy: POLICY.shortList,
      fetcher: async () => {
        const r = await apiClient().request<OrderRow[]>('GET', 'orders', { query: { box: 'seller', cursor, limit } });
        return { items: r.data ?? [], nextCursor: (r.meta?.nextCursor as string | null) ?? null };
      },
    });
    return value;
  } catch {
    return { items: [], nextCursor: null };
  }
}
