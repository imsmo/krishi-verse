// apps/web-storefront/src/app/[tenantSlug]/page.tsx · a tenant's public storefront. The SDK is configured with
// the tenant slug (sent as X-Tenant-Slug) so the API scopes the listing browse to that tenant. SSR + ISR.
import type { Metadata } from 'next';
import type { ListingCard as ListingCardData } from '@krishi-verse/sdk-js';
import { publicClient } from '../../lib/api-client';
import { ListingCard } from '../../components/ListingCard';

export const revalidate = 60;
export async function generateMetadata({ params }: { params: { tenantSlug: string } }): Promise<Metadata> {
  return { title: `${params.tenantSlug} storefront`, description: `Browse produce from ${params.tenantSlug} on Krishi-Verse.` };
}

export default async function TenantStorefront({ params, searchParams }: { params: { tenantSlug: string }; searchParams: { q?: string; cursor?: string } }) {
  let items: ListingCardData[] = []; let nextCursor: string | null = null;
  try {
    const page = await publicClient(params.tenantSlug).listings.browse({ q: searchParams.q, cursor: searchParams.cursor, limit: 24 });
    items = page.items; nextCursor = page.nextCursor;
  } catch { items = []; }

  return (
    <section>
      <h1 style={{ textTransform: 'capitalize' }}>{params.tenantSlug}</h1>
      <form method="get" style={{ margin: '12px 0' }}>
        <input name="q" defaultValue={searchParams.q ?? ''} placeholder="Search produce…" aria-label="Search produce"
          style={{ padding: 10, minHeight: 44, width: 'min(420px, 100%)', borderRadius: 8, border: '1px solid var(--kv-neutral-100)' }} />
      </form>
      {items.length === 0
        ? <p>No listings match. Try a different search.</p>
        : <div className="kv-grid">{items.map((l) => <ListingCard key={l.id} listing={l} tenantSlug={params.tenantSlug} />)}</div>}
      {nextCursor && (
        <p style={{ marginTop: 16 }}>
          <a href={`/${params.tenantSlug}?${new URLSearchParams({ ...(searchParams.q ? { q: searchParams.q } : {}), cursor: nextCursor }).toString()}`}>Next page →</a>
        </p>
      )}
    </section>
  );
}
