// apps/web-admin/src/app/providers/health/page.tsx · god-mode provider-health monitor. Server component:
// requireAdmin gates, adminGet hits GET /v1/providers/health (every provider + credential-ref coverage counts +
// the precomputed `degraded` flag). DEGRADED = the provider is DISABLED but tenants still reference it — those
// integrations fail until it is re-enabled or migrated; admin-api surfaces these first. Counts only, never secret
// material. This plane reports PERSISTED configuration health, not real-time latency. Degrade-never-die.
import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '../../../lib/admin-auth';
import { adminGet, AdminApiError } from '../../../lib/admin-client';
import { DataTable, Column } from '../../../components/DataTable';
import { getTranslator } from '../../../lib/i18n';
import { adminNoticeKey } from '../../../features/nav/nav-model';
import { categoryKey, providerHealthKey, type ProviderHealthRow } from '../../../features/providers/provider';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  return { title: getTranslator().t('providers.healthTitle'), robots: { index: false, follow: false } };
}

const HEALTH_CLASS: Record<string, string> = { active: 'kv-status--ok', degraded: 'kv-status--danger', disabled: 'kv-status--muted' };

export default async function ProviderHealthPage() {
  requireAdmin();
  const t = getTranslator();

  let rows: ProviderHealthRow[] = []; let notice: string | undefined;
  try { rows = (await adminGet<ProviderHealthRow[]>('providers/health')).data ?? []; }
  catch (e) { notice = t.t(`notice.${adminNoticeKey(e instanceof AdminApiError ? e.status : undefined)}`); }

  const degradedCount = rows.filter((r) => r.degraded).length;

  const cols: Column<ProviderHealthRow>[] = [
    { header: t.t('providers.code'), cell: (r) => <Link href={`/providers/${encodeURIComponent(r.code)}`}>{r.code}</Link> },
    { header: t.t('providers.category'), cell: (r) => t.t(`providers.cat.${categoryKey(r.category)}`) },
    { header: t.t('providers.health'), cell: (r) => { const k = providerHealthKey(r); return <span className={`kv-status ${HEALTH_CLASS[k]}`}>{t.t(`providers.healthState.${k}`)}</span>; } },
    { header: t.t('providers.configuredTenants'), cell: (r) => r.health.configuredTenants.toLocaleString() },
    { header: t.t('providers.activeTenants'), cell: (r) => r.health.activeTenants.toLocaleString() },
  ];

  return (
    <section>
      <p className="kv-backlink"><Link href="/providers">{t.t('providers.back')}</Link></p>
      <h1>{t.t('providers.healthTitle')}</h1>
      <p className="kv-muted">{t.t('providers.healthLead')}</p>

      {notice ? <p className="kv-error" role="alert">{notice}</p> : (
        <>
          {degradedCount > 0
            ? <p className="kv-error" role="alert">{t.t('providers.degradedAlarm').replace('{count}', String(degradedCount))}</p>
            : <p className="kv-success" role="status">{t.t('providers.allHealthy')}</p>}
          <DataTable columns={cols} rows={rows} empty={t.t('providers.empty')} />
        </>
      )}
    </section>
  );
}
