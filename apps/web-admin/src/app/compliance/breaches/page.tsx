// apps/web-admin/src/app/compliance/breaches/page.tsx · DPDP §8 breach console — the incident queue + open form.
// Server component: requireAdmin gates, adminGet hits GET /v1/compliance/breaches (status filter, keyset). Opening
// an incident (POST /compliance/breaches) records only data CATEGORIES (e.g. 'phone,email') — never raw PII —
// plus severity, counts and timestamps; it is a Server-Action form with a mandatory audit description. Degrade-
// never-die. No inline styles.
import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '../../../lib/admin-auth';
import { adminGet, AdminApiError } from '../../../lib/admin-client';
import { DataTable, Column } from '../../../components/DataTable';
import { getTranslator } from '../../../lib/i18n';
import { adminNoticeKey } from '../../../features/nav/nav-model';
import { BREACH_STATUSES, BREACH_SEVERITIES, breachStatusKey, breachSeverityKey, type BreachRow } from '../../../features/compliance/compliance';
import { openBreachAction } from '../actions';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  return { title: getTranslator().t('compliance.breachesTitle'), robots: { index: false, follow: false } };
}

const SEV_CLASS: Record<string, string> = { low: 'kv-status--muted', medium: 'kv-status--warn', high: 'kv-status--danger', critical: 'kv-status--danger' };
const ST_CLASS: Record<string, string> = { open: 'kv-status--danger', contained: 'kv-status--warn', notified: 'kv-status--warn', closed: 'kv-status--muted' };
const ERR = new Set(['affectedTenantId', 'severity', 'title', 'description', 'affectedData', 'affectedCount', 'detectedAt', 'elevation', 'conflict', 'invalid', 'generic']);

export default async function BreachesPage({ searchParams }: { searchParams: { cursor?: string; status?: string; error?: string } }) {
  requireAdmin();
  const t = getTranslator();
  const status = (BREACH_STATUSES as readonly string[]).includes(searchParams.status ?? '') ? searchParams.status : undefined;

  let rows: BreachRow[] = []; let nextCursor: string | undefined; let notice: string | undefined;
  try {
    const res = await adminGet<BreachRow[]>('compliance/breaches', { cursor: searchParams.cursor, status, limit: 50 });
    rows = res.data ?? [];
    nextCursor = (res.meta?.nextCursor as string | undefined) ?? undefined;
  } catch (e) { notice = t.t(`notice.${adminNoticeKey(e instanceof AdminApiError ? e.status : undefined)}`); }

  const errKey = searchParams.error && ERR.has(searchParams.error) ? searchParams.error : null;
  const cols: Column<BreachRow>[] = [
    { header: t.t('compliance.breachTitle'), cell: (r) => <Link href={`/compliance/breaches/${encodeURIComponent(r.id)}`}>{r.title}</Link> },
    { header: t.t('compliance.severity'), cell: (r) => { const s = breachSeverityKey(r.severity); return <span className={`kv-status ${SEV_CLASS[s]}`}>{t.t(`compliance.sev.${s}`)}</span>; } },
    { header: t.t('compliance.status'), cell: (r) => { const s = breachStatusKey(r.status); return <span className={`kv-status ${ST_CLASS[s]}`}>{t.t(`compliance.breachState.${s}`)}</span>; } },
    { header: t.t('compliance.affectedCount'), cell: (r) => r.affectedCount.toLocaleString() },
    { header: t.t('compliance.detectedAt'), cell: (r) => r.detectedAt ?? t.t('common.dash') },
  ];
  const filterHref = (s?: string) => `/compliance/breaches${s ? `?status=${encodeURIComponent(s)}` : ''}`;

  return (
    <section>
      <p className="kv-backlink"><Link href="/compliance">{t.t('compliance.back')}</Link></p>
      <h1>{t.t('compliance.breachesTitle')}</h1>
      <p className="kv-muted">{t.t('compliance.breachesLead')}</p>
      {errKey && <p className="kv-error" role="alert">{t.t(`compliance.error.${errKey}`)}</p>}

      <nav className="kv-filters" aria-label={t.t('compliance.filterStatus')}>
        <Link href={filterHref()} className={`kv-chip${!status ? ' is-active' : ''}`} aria-current={!status ? 'true' : undefined}>{t.t('compliance.filterAll')}</Link>
        {BREACH_STATUSES.map((s) => (
          <Link key={s} href={filterHref(s)} className={`kv-chip${status === s ? ' is-active' : ''}`} aria-current={status === s ? 'true' : undefined}>{t.t(`compliance.breachState.${s}`)}</Link>
        ))}
      </nav>

      {notice ? <p className="kv-error" role="alert">{notice}</p> : (
        <>
          <DataTable columns={cols} rows={rows} empty={t.t('compliance.breachesEmpty')} />
          {nextCursor && <p className="kv-pager"><Link className="kv-btn" href={`/compliance/breaches?cursor=${encodeURIComponent(nextCursor)}${status ? `&status=${status}` : ''}`}>{t.t('common.nextPage')}</Link></p>}
        </>
      )}

      <details className="kv-card kv-limit-form">
        <summary className="kv-card__title">{t.t('compliance.openBreach')}</summary>
        <p className="kv-field__hint">{t.t('compliance.openBreachHint')}</p>
        <form action={openBreachAction} className="kv-form">
          <label htmlFor="title" className="kv-field__label">{t.t('compliance.breachTitle')}</label>
          <input id="title" name="title" className="kv-input" required minLength={3} maxLength={200} />
          <label htmlFor="severity" className="kv-field__label">{t.t('compliance.severity')}</label>
          <select id="severity" name="severity" className="kv-input" defaultValue="high">
            {BREACH_SEVERITIES.map((s) => <option key={s} value={s}>{t.t(`compliance.sev.${s}`)}</option>)}
          </select>
          <label htmlFor="affectedData" className="kv-field__label">{t.t('compliance.affectedData')}</label>
          <input id="affectedData" name="affectedData" className="kv-input" required maxLength={500} placeholder={t.t('compliance.affectedDataHint')} />
          <label htmlFor="affectedCount" className="kv-field__label">{t.t('compliance.affectedCount')}</label>
          <input id="affectedCount" name="affectedCount" className="kv-input" inputMode="numeric" defaultValue="0" />
          <label htmlFor="affectedTenantId" className="kv-field__label">{t.t('compliance.affectedTenant')}</label>
          <input id="affectedTenantId" name="affectedTenantId" className="kv-input" placeholder={t.t('compliance.affectedTenantHint')} />
          <label htmlFor="detectedAt" className="kv-field__label">{t.t('compliance.detectedAt')}</label>
          <input id="detectedAt" name="detectedAt" className="kv-input" required placeholder={t.t('compliance.isoHint')} />
          <label htmlFor="description" className="kv-field__label">{t.t('compliance.description')}</label>
          <input id="description" name="description" className="kv-input" required minLength={3} maxLength={2000} />
          <button type="submit" className="kv-btn">{t.t('compliance.openBreachSubmit')}</button>
        </form>
      </details>
    </section>
  );
}
