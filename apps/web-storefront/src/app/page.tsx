// apps/web-storefront/src/app/page.tsx · public home. SSR-fetches a sample of published listings via the SDK
// (anonymous) and renders them. Degrades gracefully: if the API is unavailable the page still renders with an
// empty state (Law 12 — a flaky dependency never 500s the public storefront). Revalidated periodically (ISR).
import type { Metadata } from 'next';
import type { ListingCard as ListingCardData } from '@krishi-verse/sdk-js';
import { publicClient } from '../lib/api-client';
import { ListingCard } from '../components/ListingCard';

export const metadata: Metadata = { title: 'Fresh from the farm', description: 'Browse fresh produce and agri-inputs from verified sellers.' };
export const revalidate = 60;   // ISR: re-fetch at most once a minute

export default async function HomePage() {
  let items: ListingCardData[] = [];
  try {
    const page = await publicClient().listings.browse({ limit: 12, sort: 'newest' });
    items = page.items;
  } catch { items = []; }   // search/API down → empty state, never a crash

  return (
    <section>
      <h1>Fresh from the farm</h1>
      <p style={{ color: 'var(--kv-neutral-600)' }}>Produce and agri-inputs from verified sellers across India.</p>
      {items.length === 0
        ? <p>No listings to show right now. Please check back shortly.</p>
        : <div className="kv-grid">{items.map((l) => <ListingCard key={l.id} listing={l} tenantSlug="market" />)}</div>}
    </section>
  );
}
