// apps/web-tenant/src/app/listings/page.tsx · the tenant's listings (authed, tenant-scoped by the API token).
// Keyset "next page" (never OFFSET). Money via formatMoneyMinor from the bigint-string. Degrades to empty state.
import { requireSession } from '../../lib/auth';
import { tenantClient } from '../../lib/api-client';
import { DataTable } from '../../components/DataTable';
import { formatMoneyMinor } from '@krishi-verse/i18n';
import type { ListingCard } from '@krishi-verse/sdk-js';

export const dynamic = 'force-dynamic';

export default async function ListingsPage({ searchParams }: { searchParams: { cursor?: string } }) {
  requireSession();
  let items: ListingCard[] = []; let nextCursor: string | null = null;
  try { const p = await tenantClient().listings.browse({ cursor: searchParams.cursor, limit: 50 }); items = p.items; nextCursor = p.nextCursor; } catch { items = []; }
  return (
    <section>
      <h1>Listings</h1>
      <DataTable
        rows={items}
        empty="No listings yet."
        columns={[
          { header: 'Title', cell: (l) => l.title },
          { header: 'Price', cell: (l) => formatMoneyMinor(l.priceMinor, l.currencyCode) + ' / ' + l.unitCode },
          { header: 'Available', cell: (l) => `${l.quantityAvailable} ${l.unitCode}` },
          { header: 'Type', cell: (l) => l.saleType },
          { header: 'Organic', cell: (l) => (l.organicClaim ? 'Yes' : '—') },
        ]}
      />
      {nextCursor && <p style={{ marginTop: 16 }}><a href={`/listings?cursor=${encodeURIComponent(nextCursor)}`}>Next page →</a></p>}
    </section>
  );
}
