// apps/web-storefront/src/app/[tenantSlug]/listings/[id]/page.tsx · a single listing detail page. SSR-fetched
// via the SDK; a missing/unavailable listing renders Next's notFound() (404) rather than crashing.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { formatMoneyMinor } from '@krishi-verse/i18n';
import type { ListingCard } from '@krishi-verse/sdk-js';
import { SdkError } from '@krishi-verse/sdk-js';
import { publicClient } from '../../../../lib/api-client';

export const revalidate = 60;

async function load(tenantSlug: string, id: string): Promise<ListingCard | null> {
  try { return await publicClient(tenantSlug).listings.get(id); }
  catch (e) { if (e instanceof SdkError && e.isNotFound) return null; throw e; }
}

export async function generateMetadata({ params }: { params: { tenantSlug: string; id: string } }): Promise<Metadata> {
  const l = await load(params.tenantSlug, params.id);
  return l ? { title: l.title, description: `${l.title} — ${formatMoneyMinor(l.priceMinor, l.currencyCode)} / ${l.unitCode}` } : { title: 'Listing not found' };
}

export default async function ListingDetail({ params }: { params: { tenantSlug: string; id: string } }) {
  const l = await load(params.tenantSlug, params.id);
  if (!l) notFound();
  return (
    <article>
      <h1>{l.title}</h1>
      <p className="kv-card__price" style={{ fontSize: 22 }}>{formatMoneyMinor(l.priceMinor, l.currencyCode)} <span className="kv-card__unit">/ {l.unitCode}</span></p>
      <ul style={{ color: 'var(--kv-neutral-600)' }}>
        <li>{l.quantityAvailable} {l.unitCode} available</li>
        <li>Sale type: {l.saleType}</li>
        {l.organicClaim && <li><span className="kv-badge kv-badge--organic">Organic</span></li>}
      </ul>
    </article>
  );
}
