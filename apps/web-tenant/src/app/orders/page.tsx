// apps/web-tenant/src/app/orders/page.tsx · the tenant's orders (authed). Uses the SDK's generic request()
// escape hatch (no dedicated orders resource yet) with the SAME envelope + resilience. Money via the i18n
// formatter from the bigint-string. Keyset paging. Degrades to empty state.
import { requireSession } from '../../lib/auth';
import { tenantClient } from '../../lib/api-client';
import { DataTable } from '../../components/DataTable';
import { formatMoneyMinor, formatDate } from '@krishi-verse/i18n';

interface OrderRow { id: string; status: string; totalMinor: string; currencyCode: string; createdAt: string; }

export const dynamic = 'force-dynamic';

export default async function OrdersPage({ searchParams }: { searchParams: { cursor?: string } }) {
  requireSession();
  let items: OrderRow[] = []; let nextCursor: string | null = null;
  try {
    const r = await tenantClient().request<OrderRow[]>('GET', 'orders', { query: { box: 'tenant', cursor: searchParams.cursor, limit: 50 } });
    items = r.data ?? []; nextCursor = (r.meta?.nextCursor as string | null) ?? null;
  } catch { items = []; }
  return (
    <section>
      <h1>Orders</h1>
      <DataTable
        rows={items}
        empty="No orders yet."
        columns={[
          { header: 'Order', cell: (o) => <span>{o.id.slice(0, 8)}…</span> },
          { header: 'Status', cell: (o) => <span className="kv-badge">{o.status}</span> },
          { header: 'Total', cell: (o) => formatMoneyMinor(o.totalMinor, o.currencyCode) },
          { header: 'Placed', cell: (o) => formatDate(o.createdAt) },
        ]}
      />
      {nextCursor && <p style={{ marginTop: 16 }}><a href={`/orders?cursor=${encodeURIComponent(nextCursor)}`}>Next page →</a></p>}
    </section>
  );
}
