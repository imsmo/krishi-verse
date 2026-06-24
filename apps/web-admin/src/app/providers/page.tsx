// apps/web-admin/src/app/providers/page.tsx · god-mode integration-provider registry. Server component:
// requireAdmin gates, adminGet hits GET /v1/providers (category + active filter, keyset paging). Providers are
// platform-seeded — this is a READ surface; the one consequential write (enable/disable, Law 12) lives on the
// detail page. Health/financial lenses are linked in the section nav. Degrade-never-die. No inline styles.
import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '../../lib/admin-auth';
import { adminGet, AdminApiError } from '../../lib/admin-client';
import { DataTable, Column } from '../../components/DataTable';
import { getTranslator } from '../../lib/i18n';
import { adminNoticeKey } from '../../features/nav/nav-model';
import { PROVIDER_CATEGORIES, isValidCategory, categoryKey, providerHealthKey, type ProviderRow } from '../../features/providers/provider';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  return { title: getTranslator().t('providers.title'), robots: { index: false, follow: false } };
}

const HEALTH_CLASS: Record<string, string> = { active: 'kv-status--ok', degraded: 'kv-status--danger', disabled: 'kv-status--muted' };

export default async function ProvidersPage({ searchParams }: { searchParams: { cursor?: string; category?: string; active?: string } }) {
  requireAdmin();
  const t = getTranslator();
  const category = isValidCategory(searchParams.category) ? searchParams.category : undefined;
  const active = searchParams.active === 'true' ? 'true' : searchParams.active === 'false' ? 'false' : undefined;

  let rows: ProviderRow[] = []; let nextCursor: string | undefined; let notice: string | undefined;
  try {
    const res = await adminGet<ProviderRow[]>('providers', { cursor: searchParams.cursor, category, isActive: active, limit: 50 });
    rows = res.data ?? [];
    nextCursor = (res.meta?.nextCursor as string | undefined) ?? undefined;
  } catch (e) { notice = t.t(`notice.${adminNoticeKey(e instanceof AdminApiError ? e.status : undefined)}`); }

  const cols: Column<ProviderRow>[] = [
    { header: t.t('providers.code'), cell: (r) => <Link href={`/providers/${encodeURIComponent(r.code)}`}>{r.code}</Link> },
    { header: t.t('providers.name'), cell: (r) => r.defaultName },
    { header: t.t('providers.category'), cell: (r) => t.t(`providers.cat.${categoryKey(r.category)}`) },
    { header: t.t('providers.health'), cell: (r) => { const k = providerHealthKey(r); return <span className={`kv-status ${HEALTH_CLASS[k]}`}>{t.t(`providers.healthState.${k}`)}</span>; } },
    { header: t.t('providers.configured'), cell: (r) => `${r.health.activeTenants.toLocaleString()} / ${r.health.configuredTenants.toLocaleString()}` },
  ];

  const qp = (extra: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { category, active, ...extra };
    for (const [k, v] of Object.entries(merged)) if (v) sp.append(k, v);
    const s = sp.toString();
    return `/providers${s ? `?${s}` : ''}`;
  };

  return (
    <section>
      <h1>{t.t('providers.title')}</h1>
      <p className="kv-muted">{t.t('providers.lead')}</p>
      <nav className="kv-filters" aria-label={t.t('providers.nav')}>
        <Link href="/providers/health" className="kv-chip">{t.t('providers.healthNav')}</Link>
        <Link href="/providers/financial" className="kv-chip">{t.t('providers.financialNav')}</Link>
      </nav>

      <nav className="kv-filters" aria-label={t.t('providers.filterCategory')}>
        <Link href={qp({ category: undefined, cursor: undefined })} className={`kv-chip${!category ? ' is-active' : ''}`} aria-current={!category ? 'true' : undefined}>{t.t('providers.filterAll')}</Link>
        {PROVIDER_CATEGORIES.map((c) => (
          <Link key={c} href={qp({ category: c, cursor: undefined })} className={`kv-chip${category === c ? ' is-active' : ''}`} aria-current={category === c ? 'true' : undefined}>{t.t(`providers.cat.${c}`)}</Link>
        ))}
      </nav>
      <nav className="kv-filters" aria-label={t.t('providers.filterActive')}>
        <Link href={qp({ active: undefined, cursor: undefined })} className={`kv-chip${!active ? ' is-active' : ''}`} aria-current={!active ? 'true' : undefined}>{t.t('providers.filterAll')}</Link>
        <Link href={qp({ active: 'true', cursor: undefined })} className={`kv-chip${active === 'true' ? ' is-active' : ''}`} aria-current={active === 'true' ? 'true' : undefined}>{t.t('providers.filterEnabled')}</Link>
        <Link href={qp({ active: 'false', cursor: undefined })} className={`kv-chip${active === 'false' ? ' is-active' : ''}`} aria-current={active === 'false' ? 'true' : undefined}>{t.t('providers.filterDisabled')}</Link>
      </nav>

      {notice ? <p className="kv-error" role="alert">{notice}</p> : (
        <>
          <DataTable columns={cols} rows={rows} empty={t.t('providers.empty')} />
          {nextCursor && <p className="kv-pager"><Link className="kv-btn" href={qp({ cursor: nextCursor })}>{t.t('common.nextPage')}</Link></p>}
        </>
      )}
    </section>
  );
}
