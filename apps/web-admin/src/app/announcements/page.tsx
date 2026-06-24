// apps/web-admin/src/app/announcements/page.tsx · god-mode platform-announcements. Server component: requireAdmin
// gates, adminGet hits GET /v1/announcements (status + severity filter, keyset) and GET /active (the currently-live
// set) in parallel, each degrading independently. A create form (POST) starts a draft; text is plain (no HTML,
// validated in features/announcements). A platform notice reaches every tenant. Degrade-never-die. No inline styles.
import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '../../lib/admin-auth';
import { adminGet, AdminApiError } from '../../lib/admin-client';
import { DataTable, Column } from '../../components/DataTable';
import { getTranslator } from '../../lib/i18n';
import { adminNoticeKey } from '../../features/nav/nav-model';
import { ANNOUNCEMENT_STATUSES, SEVERITIES, PLACEMENTS, announcementStatusKey, type AnnouncementRow } from '../../features/announcements/announcement';
import { createAnnouncementAction } from './actions';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  return { title: getTranslator().t('ann.title'), robots: { index: false, follow: false } };
}

const ST_CLASS: Record<string, string> = { draft: 'kv-status--muted', scheduled: 'kv-status--warn', published: 'kv-status--ok', expired: 'kv-status--muted', archived: 'kv-status--muted' };
const SEV_CLASS: Record<string, string> = { info: 'kv-status--muted', warning: 'kv-status--warn', critical: 'kv-status--danger' };
const ERR = new Set(['title', 'body', 'severity', 'placement', 'plans', 'countries', 'reason', 'elevation', 'conflict', 'invalid', 'generic']);

export default async function AnnouncementsPage({ searchParams }: { searchParams: { cursor?: string; status?: string; severity?: string; ok?: string; error?: string } }) {
  requireAdmin();
  const t = getTranslator();
  const status = (ANNOUNCEMENT_STATUSES as readonly string[]).includes(searchParams.status ?? '') ? searchParams.status : undefined;
  const severity = (SEVERITIES as readonly string[]).includes(searchParams.severity ?? '') ? searchParams.severity : undefined;

  let rows: AnnouncementRow[] = []; let nextCursor: string | undefined; let notice: string | undefined;
  try {
    const res = await adminGet<AnnouncementRow[]>('announcements', { cursor: searchParams.cursor, status, severity, limit: 50 });
    rows = res.data ?? [];
    nextCursor = (res.meta?.nextCursor as string | undefined) ?? undefined;
  } catch (e) { notice = t.t(`notice.${adminNoticeKey(e instanceof AdminApiError ? e.status : undefined)}`); }

  let active: AnnouncementRow[] = [];
  try { active = (await adminGet<AnnouncementRow[]>('announcements/active')).data ?? []; } catch { /* degrade */ }

  const okCreated = searchParams.ok === 'created';
  const errKey = searchParams.error && ERR.has(searchParams.error) ? searchParams.error : null;
  const cols: Column<AnnouncementRow>[] = [
    { header: t.t('ann.titleCol'), cell: (r) => <Link href={`/announcements/${encodeURIComponent(r.id)}`}>{r.title}</Link> },
    { header: t.t('ann.severity'), cell: (r) => <span className={`kv-status ${SEV_CLASS[r.severity] ?? ''}`}>{t.t(`ann.sev.${r.severity}`)}</span> },
    { header: t.t('ann.placement'), cell: (r) => t.t(`ann.place.${r.placement}`) },
    { header: t.t('ann.status'), cell: (r) => { const s = announcementStatusKey(r.status); return <span className={`kv-status ${ST_CLASS[s]}`}>{t.t(`ann.state.${s}`)}</span>; } },
    { header: t.t('ann.endsAt'), cell: (r) => r.endsAt ?? t.t('common.dash') },
  ];
  const qp = (extra: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { status, severity, ...extra };
    for (const [k, v] of Object.entries(merged)) if (v) sp.append(k, v);
    const s = sp.toString();
    return `/announcements${s ? `?${s}` : ''}`;
  };

  return (
    <section>
      <h1>{t.t('ann.title')}</h1>
      <p className="kv-muted">{t.t('ann.lead')}</p>
      {okCreated && <p className="kv-success" role="status">{t.t('ann.ok.created')}</p>}
      {errKey && <p className="kv-error" role="alert">{t.t(`ann.error.${errKey}`)}</p>}

      <h2>{t.t('ann.activeHeading')}</h2>
      {active.length === 0 ? <p className="kv-muted">{t.t('ann.activeEmpty')}</p> : (
        <ul className="kv-card-grid">{active.map((a) => (
          <li key={a.id} className="kv-card">
            <Link href={`/announcements/${encodeURIComponent(a.id)}`} className="kv-card__title">{a.title}</Link>
            <p><span className={`kv-status ${SEV_CLASS[a.severity] ?? ''}`}>{t.t(`ann.sev.${a.severity}`)}</span> · {t.t(`ann.place.${a.placement}`)}</p>
            <p className="kv-muted">{t.t('ann.endsAt')}: {a.endsAt ?? t.t('common.dash')}</p>
          </li>
        ))}</ul>
      )}

      <h2>{t.t('ann.allHeading')}</h2>
      <nav className="kv-filters" aria-label={t.t('ann.filterStatus')}>
        <Link href={qp({ status: undefined, cursor: undefined })} className={`kv-chip${!status ? ' is-active' : ''}`} aria-current={!status ? 'true' : undefined}>{t.t('ann.filterAll')}</Link>
        {ANNOUNCEMENT_STATUSES.map((s) => (
          <Link key={s} href={qp({ status: s, cursor: undefined })} className={`kv-chip${status === s ? ' is-active' : ''}`} aria-current={status === s ? 'true' : undefined}>{t.t(`ann.state.${s}`)}</Link>
        ))}
      </nav>
      <nav className="kv-filters" aria-label={t.t('ann.filterSeverity')}>
        <Link href={qp({ severity: undefined, cursor: undefined })} className={`kv-chip${!severity ? ' is-active' : ''}`} aria-current={!severity ? 'true' : undefined}>{t.t('ann.filterAll')}</Link>
        {SEVERITIES.map((s) => (
          <Link key={s} href={qp({ severity: s, cursor: undefined })} className={`kv-chip${severity === s ? ' is-active' : ''}`} aria-current={severity === s ? 'true' : undefined}>{t.t(`ann.sev.${s}`)}</Link>
        ))}
      </nav>

      {notice ? <p className="kv-error" role="alert">{notice}</p> : (
        <>
          <DataTable columns={cols} rows={rows} empty={t.t('ann.empty')} />
          {nextCursor && <p className="kv-pager"><Link className="kv-btn" href={qp({ cursor: nextCursor })}>{t.t('common.nextPage')}</Link></p>}
        </>
      )}

      <details className="kv-card kv-limit-form">
        <summary className="kv-card__title">{t.t('ann.create')}</summary>
        <p className="kv-field__hint">{t.t('ann.createHint')}</p>
        <form action={createAnnouncementAction} className="kv-form">
          <label htmlFor="title" className="kv-field__label">{t.t('ann.titleCol')}</label>
          <input id="title" name="title" className="kv-input" required maxLength={200} />
          <label htmlFor="body" className="kv-field__label">{t.t('ann.body')}</label>
          <input id="body" name="body" className="kv-input" required maxLength={4000} />
          <label htmlFor="severity" className="kv-field__label">{t.t('ann.severity')}</label>
          <select id="severity" name="severity" className="kv-input" defaultValue="info">{SEVERITIES.map((s) => <option key={s} value={s}>{t.t(`ann.sev.${s}`)}</option>)}</select>
          <label htmlFor="placement" className="kv-field__label">{t.t('ann.placement')}</label>
          <select id="placement" name="placement" className="kv-input" defaultValue="banner">{PLACEMENTS.map((p) => <option key={p} value={p}>{t.t(`ann.place.${p}`)}</option>)}</select>
          <label htmlFor="plans" className="kv-field__label">{t.t('ann.plans')}</label>
          <input id="plans" name="plans" className="kv-input" placeholder={t.t('ann.plansHint')} />
          <label htmlFor="countries" className="kv-field__label">{t.t('ann.countries')}</label>
          <input id="countries" name="countries" className="kv-input" placeholder={t.t('ann.countriesHint')} />
          <label htmlFor="createReason" className="kv-field__label">{t.t('ann.reason')}</label>
          <input id="createReason" name="reason" className="kv-input" required minLength={3} maxLength={1000} />
          <button type="submit" className="kv-btn">{t.t('ann.createSubmit')}</button>
        </form>
      </details>
    </section>
  );
}
