// apps/web-admin/src/app/tenants/page.tsx · god-mode tenant directory. Server component: requireAdmin gates,
// adminGet hits admin-api GET /v1/tenants (owner perm enforced server-side; reads across ALL tenants by design —
// Law 11). Keyset pagination (?cursor=) + a status filter. Degrade-never-die: failures map (features/nav
// adminNoticeKey) to a localized notice (403 → re-auth). Slug/id link to the per-tenant scorecard.
import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '../../lib/admin-auth';
import { adminGet, AdminApiError } from '../../lib/admin-client';
import { DataTable, Column } from '../../components/DataTable';
import { getTranslator } from '../../lib/i18n';
import { adminNoticeKey } from '../../features/nav/nav-model';
import { TENANT_STATUSES, statusKey, type TenantListItem } from '../../features/tenants/tenant';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  return { title: getTranslator().t('tenants.title'), robots: { index: false, follow: false } };
}

const STATUS_CLASS: Record<string, string> = {
  pending: 'kv-status--warn', trial: 'kv-status--ok', active: 'kv-status--ok', grace: 'kv-status--warn',
  suspended: 'kv-status--danger', archived: 'kv-status--muted', terminated: 'kv-status--muted',
};

export default async function TenantsPage({ searchParams }: { searchParams: { cursor?: string; status?: string; q?: string } }) {
  requireAdmin();
  const t = getTranslator();
  const status = (TENANT_STATUSES as readonly string[]).includes(searchParams.status ?? '') ? searchParams.status : undefined;

  let rows: TenantListItem[] = [];
  let nextCursor: string | undefined;
  let notice: string | undefined;
  try {
    const res = await adminGet<TenantListItem[]>('tenants', { cursor: searchParams.cursor, status, q: searchParams.q, limit: 50 });
    rows = res.data ?? [];
    nextCursor = (res.meta?.nextCursor as string | undefined) ?? undefined;
  } catch (e) {
    notice = t.t(`notice.${adminNoticeKey(e instanceof AdminApiError ? e.status : undefined)}`);
  }

  const columns: Column<TenantListItem>[] = [
    { header: t.t('tenants.colSlug'), cell: (r) => <Link href={`/tenants/${r.id}`}>{r.slug}</Link> },
    { header: t.t('tenants.colStatus'), cell: (r) => <span className={`kv-status ${STATUS_CLASS[r.status] ?? ''}`}>{t.t(`tenants.status.${statusKey(r.status)}`)}</span> },
    { header: t.t('tenants.colRisk'), cell: (r) => String(r.riskScore) },
  ];

  const filterHref = (s?: string) => `/tenants${s ? `?status=${encodeURIComponent(s)}` : ''}`;

  return (
    <section>
      <h1>{t.t('tenants.title')}</h1>
      <p className="kv-muted">{t.t('tenants.lead')}</p>

      <nav className="kv-filters" aria-label={t.t('tenants.filterLabel')}>
        <Link href={filterHref()} className={`kv-chip${!status ? ' is-active' : ''}`} aria-current={!status ? 'true' : undefined}>{t.t('tenants.filterAll')}</Link>
        {TENANT_STATUSES.map((s) => (
          <Link key={s} href={filterHref(s)} className={`kv-chip${status === s ? ' is-active' : ''}`} aria-current={status === s ? 'true' : undefined}>{t.t(`tenants.status.${s}`)}</Link>
        ))}
      </nav>

      {notice ? <p className="kv-error" role="alert">{notice}</p> : (
        <>
          <DataTable columns={columns} rows={rows} empty={t.t('tenants.empty')} />
          {nextCursor && (
            <p className="kv-pager">
              <Link className="kv-btn" href={`/tenants?cursor=${encodeURIComponent(nextCursor)}${status ? `&status=${encodeURIComponent(status)}` : ''}`}>{t.t('common.nextPage')}</Link>
            </p>
          )}
        </>
      )}
    </section>
  );
}
