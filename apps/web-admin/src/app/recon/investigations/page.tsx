// apps/web-admin/src/app/recon/investigations/page.tsx · mismatch-investigation queue. Server component:
// requireAdmin gates, adminGet hits GET /v1/recon/investigations (status filter + keyset). Degrade-never-die.
import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '../../../lib/admin-auth';
import { adminGet, AdminApiError } from '../../../lib/admin-client';
import { DataTable, Column } from '../../../components/DataTable';
import { getTranslator } from '../../../lib/i18n';
import { adminNoticeKey } from '../../../features/nav/nav-model';
import { INVESTIGATION_STATUSES, investigationStatusKey, severityKey, type Investigation } from '../../../features/recon/recon';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  return { title: getTranslator().t('recon.invTitle'), robots: { index: false, follow: false } };
}

const SEV_CLASS: Record<string, string> = { low: 'kv-status--muted', medium: '', high: 'kv-status--warn', critical: 'kv-status--danger' };

export default async function InvestigationsPage({ searchParams }: { searchParams: { cursor?: string; status?: string; ok?: string } }) {
  requireAdmin();
  const t = getTranslator();
  const status = (INVESTIGATION_STATUSES as readonly string[]).includes(searchParams.status ?? '') ? searchParams.status : undefined;

  let rows: Investigation[] = []; let nextCursor: string | undefined; let notice: string | undefined;
  try {
    const res = await adminGet<Investigation[]>('recon/investigations', { cursor: searchParams.cursor, status, limit: 50 });
    rows = res.data ?? [];
    nextCursor = (res.meta?.nextCursor as string | undefined) ?? undefined;
  } catch (e) { notice = t.t(`notice.${adminNoticeKey(e instanceof AdminApiError ? e.status : undefined)}`); }

  const okKey = searchParams.ok === 'opened' ? 'opened' : null;
  const cols: Column<Investigation>[] = [
    { header: t.t('recon.invSeverity'), cell: (i) => { const s = severityKey(i.severity); return <span className={`kv-status ${SEV_CLASS[s] ?? ''}`}>{t.t(`recon.severity.${s}`)}</span>; } },
    { header: t.t('recon.invStatus'), cell: (i) => t.t(`recon.invState.${investigationStatusKey(i.status)}`) },
    { header: t.t('recon.invSummary'), cell: (i) => <Link href={`/recon/investigations/${i.id}`}>{i.summary}</Link> },
  ];
  const filterHref = (s?: string) => `/recon/investigations${s ? `?status=${encodeURIComponent(s)}` : ''}`;

  return (
    <section>
      <p className="kv-backlink"><Link href="/recon">{t.t('recon.back')}</Link></p>
      <h1>{t.t('recon.invTitle')}</h1>
      {okKey && <p className="kv-success" role="status">{t.t('recon.ok.opened')}</p>}

      <nav className="kv-filters" aria-label={t.t('recon.filterLabel')}>
        <Link href={filterHref()} className={`kv-chip${!status ? ' is-active' : ''}`} aria-current={!status ? 'true' : undefined}>{t.t('recon.filterAll')}</Link>
        {INVESTIGATION_STATUSES.map((s) => (
          <Link key={s} href={filterHref(s)} className={`kv-chip${status === s ? ' is-active' : ''}`} aria-current={status === s ? 'true' : undefined}>{t.t(`recon.invState.${s}`)}</Link>
        ))}
      </nav>

      {notice ? <p className="kv-error" role="alert">{notice}</p> : (
        <>
          <DataTable columns={cols} rows={rows} empty={t.t('recon.noInvestigations')} />
          {nextCursor && <p className="kv-pager"><Link className="kv-btn" href={`/recon/investigations?cursor=${encodeURIComponent(nextCursor)}${status ? `&status=${status}` : ''}`}>{t.t('common.nextPage')}</Link></p>}
        </>
      )}
    </section>
  );
}
