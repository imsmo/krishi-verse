// apps/web-tenant/src/app/listings/page.tsx · the tenant's listings (authed, tenant-scoped by the API token).
// Keyset "next page" (never OFFSET). Money via formatMoneyMinor from the bigint-string. All copy via i18n;
// degrades to an empty/error state (Law 12); noindex.
import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '../../lib/session';
import { tenantClient } from '../../lib/api-client';
import { DataTable } from '../../components/DataTable';
import { getTranslator, getLang } from '../../lib/i18n';
import { formatMoneyMinor } from '@krishi-verse/i18n';
import type { ListingCard } from '@krishi-verse/sdk-js';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  return { title: getTranslator().t('listings.title'), robots: { index: false, follow: false } };
}

export default async function ListingsPage({ searchParams }: { searchParams: { cursor?: string; created?: string } }) {
  await requireSession('/listings');
  const t = getTranslator();
  const lang = getLang();
  let items: ListingCard[] = []; let nextCursor: string | null = null; let failed = false;
  try { const p = await tenantClient().listings.browse({ cursor: searchParams.cursor, limit: 50 }); items = p.items; nextCursor = p.nextCursor; }
  catch (e) { failed = true; console.error('[listings] load failed:', e); }

  return (
    <section>
      <div className="kv-page-head">
        <h1>{t.t('listings.title')}</h1>
        <Link href="/listings/new" className="kv-btn">{t.t('listings.newCta')}</Link>
      </div>
      {searchParams.created && <p className="kv-success" role="status">{t.t('listingNew.created')}</p>}
      {failed ? <p className="kv-error" role="alert">{t.t('listings.loadError')}</p> : (
        <DataTable
          rows={items}
          empty={t.t('listings.empty')}
          columns={[
            { header: t.t('listings.colTitle'), cell: (l) => <Link href={`/listings/${l.id}`} className="kv-link">{l.title}</Link> },
            { header: t.t('listings.colPrice'), cell: (l) => `${formatMoneyMinor(l.priceMinor, l.currencyCode, lang)} / ${l.unitCode}` },
            { header: t.t('listings.colAvailable'), cell: (l) => `${l.quantityAvailable} ${l.unitCode}` },
            { header: t.t('listings.colType'), cell: (l) => l.saleType },
            { header: t.t('listings.colOrganic'), cell: (l) => (l.organicClaim ? t.t('listings.organicYes') : t.t('common.dash')) },
          ]}
        />
      )}
      {nextCursor && <p className="kv-pager"><a href={`/listings?cursor=${encodeURIComponent(nextCursor)}`} className="kv-btn--link">{t.t('common.nextPage')}</a></p>}
    </section>
  );
}
