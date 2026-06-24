// apps/web-tenant/src/app/disputes/page.tsx · the tenant's disputes moderation view + the seller's review rating.
// Server-first, requireSession-gated. Loads the dispute queue (disputes.list box=all, keyset) and the rating
// summary (auth.me() → reviews.summary({ targetUserId })) in parallel, each degrading independently (Law 12).
// All copy via i18n; noindex. The API enforces dispute.resolve + tenant scope server-side.
import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '../../lib/session';
import { tenantClient } from '../../lib/api-client';
import { DataTable } from '../../components/DataTable';
import { getTranslator, getLang } from '../../lib/i18n';
import { formatDate } from '@krishi-verse/i18n';
import type { Dispute, ReviewSummary, UserProfile } from '@krishi-verse/sdk-js';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  return { title: getTranslator().t('disputes.title'), robots: { index: false, follow: false } };
}

export default async function DisputesPage({ searchParams }: { searchParams: { cursor?: string; status?: string } }) {
  await requireSession('/disputes');
  const t = getTranslator();
  const lang = getLang();

  let disputes: Dispute[] = []; let nextCursor: string | null = null; let failed = false;
  let summary: ReviewSummary | null = null;
  // Rating needs the seller's own id; resolve it then read the summary (best-effort).
  let me: UserProfile | null = null;
  const [dRes, meRes] = await Promise.allSettled([
    tenantClient().disputes.list({ box: 'all', status: searchParams.status, cursor: searchParams.cursor, limit: 50 }),
    tenantClient().auth.me(),
  ]);
  if (dRes.status === 'fulfilled') { disputes = dRes.value.items; nextCursor = dRes.value.nextCursor; } else { failed = true; }
  if (meRes.status === 'fulfilled') me = meRes.value;
  if (me) { try { summary = await tenantClient().reviews.summary({ targetUserId: me.id }); } catch { summary = null; } }

  return (
    <section>
      <h1>{t.t('disputes.title')}</h1>

      <div className="kv-card">
        <h2 className="kv-card__title">{t.t('disputes.rating')}</h2>
        {summary ? (
          <p>{t.t('disputes.ratingValue', { stars: summary.averageStars.toString(), count: summary.count.toString() })}</p>
        ) : (
          <p className="kv-muted">{t.t('disputes.ratingNone')}</p>
        )}
      </div>

      <h2 className="kv-section-title">{t.t('disputes.queue')}</h2>
      {failed ? <p className="kv-error" role="alert">{t.t('disputes.loadError')}</p> : (
        <DataTable
          rows={disputes}
          empty={t.t('disputes.empty')}
          columns={[
            { header: t.t('disputes.colId'), cell: (d) => <Link href={`/disputes/${d.id}`} className="kv-link">{d.id.slice(0, 8)}</Link> },
            { header: t.t('disputes.colOrder'), cell: (d) => <Link href={`/orders/${d.orderId}`} className="kv-link">{d.orderId.slice(0, 8)}</Link> },
            { header: t.t('disputes.colStatus'), cell: (d) => <span className="kv-badge">{d.status}</span> },
            { header: t.t('disputes.colSla'), cell: (d) => (d.slaDueAt ? formatDate(d.slaDueAt, lang) : t.t('common.dash')) },
            { header: t.t('disputes.colCreated'), cell: (d) => (d.createdAt ? formatDate(d.createdAt, lang) : t.t('common.dash')) },
          ]}
        />
      )}
      {nextCursor && <p className="kv-pager"><a href={`/disputes?cursor=${encodeURIComponent(nextCursor)}`} className="kv-btn--link">{t.t('common.nextPage')}</a></p>}
    </section>
  );
}
