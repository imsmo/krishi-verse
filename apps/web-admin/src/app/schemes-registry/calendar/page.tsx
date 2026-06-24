// apps/web-admin/src/app/schemes-registry/calendar/page.tsx · read-only window calendar — active schemes whose
// application window is open on a given 'MM-DD' (default today). Server component: requireAdmin gates, adminGet
// hits GET /v1/schemes-registry/schemes/calendar. A plain GET <form> sets the date (no client JS). Degrade-never-die.
import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '../../../lib/admin-auth';
import { adminGet, AdminApiError } from '../../../lib/admin-client';
import { DataTable, Column } from '../../../components/DataTable';
import { getTranslator } from '../../../lib/i18n';
import { adminNoticeKey } from '../../../features/nav/nav-model';
import { isMmDd, type SchemeRow } from '../../../features/schemes-registry/scheme';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  return { title: getTranslator().t('sr.calendarTitle'), robots: { index: false, follow: false } };
}

export default async function CalendarPage({ searchParams }: { searchParams: { onDate?: string; cursor?: string } }) {
  requireAdmin();
  const t = getTranslator();
  const onDate = isMmDd(searchParams.onDate) ? searchParams.onDate : undefined;

  let rows: SchemeRow[] = []; let nextCursor: string | undefined; let effectiveDate: string | undefined; let notice: string | undefined;
  try {
    const res = await adminGet<SchemeRow[]>('schemes-registry/schemes/calendar', { onDate, cursor: searchParams.cursor, limit: 50 });
    rows = res.data ?? [];
    nextCursor = (res.meta?.nextCursor as string | undefined) ?? undefined;
    effectiveDate = (res.meta?.onDate as string | undefined) ?? undefined;
  } catch (e) { notice = t.t(`notice.${adminNoticeKey(e instanceof AdminApiError ? e.status : undefined)}`); }

  const cols: Column<SchemeRow>[] = [
    { header: t.t('sr.schemeCode'), cell: (r) => <Link href={`/schemes-registry/schemes/${encodeURIComponent(r.id)}`}>{r.code}</Link> },
    { header: t.t('sr.schemeName'), cell: (r) => r.defaultName },
    { header: t.t('sr.window'), cell: (r) => (r.applicationWindow ? `${r.applicationWindow.opens} → ${r.applicationWindow.closes}` : t.t('common.dash')) },
  ];
  const nextHref = () => {
    const sp = new URLSearchParams();
    if (onDate) sp.append('onDate', onDate);
    if (nextCursor) sp.append('cursor', nextCursor);
    return `/schemes-registry/calendar?${sp.toString()}`;
  };

  return (
    <section>
      <p className="kv-backlink"><Link href="/schemes-registry">{t.t('sr.back')}</Link></p>
      <h1>{t.t('sr.calendarTitle')}</h1>
      <p className="kv-muted">{t.t('sr.calendarLead')}{effectiveDate ? ` ${t.t('sr.calendarOn')} ${effectiveDate}` : ''}</p>

      <form method="get" className="kv-form kv-filters" aria-label={t.t('sr.calendarFilter')}>
        <input name="onDate" className="kv-input kv-input--sm" defaultValue={onDate ?? ''} placeholder={t.t('sr.mmddHint')} />
        <button type="submit" className="kv-btn">{t.t('sr.calendarApply')}</button>
      </form>

      {notice ? <p className="kv-error" role="alert">{notice}</p> : (
        <>
          <DataTable columns={cols} rows={rows} empty={t.t('sr.calendarEmpty')} />
          {nextCursor && <p className="kv-pager"><Link className="kv-btn" href={nextHref()}>{t.t('common.nextPage')}</Link></p>}
        </>
      )}
    </section>
  );
}
