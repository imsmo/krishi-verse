// apps/web-admin/src/app/schemes-registry/page.tsx · god-mode government-scheme MASTER — issuing authorities.
// Server component: requireAdmin gates, adminGet hits GET /v1/schemes-registry/authorities (level filter, keyset).
// A create form (POST) adds an issuing body. The schemes + calendar lenses are linked in the section nav. A
// master edit ripples into every tenant's scheme catalogue. Degrade-never-die. No inline styles.
import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '../../lib/admin-auth';
import { adminGet, AdminApiError } from '../../lib/admin-client';
import { DataTable, Column } from '../../components/DataTable';
import { getTranslator } from '../../lib/i18n';
import { adminNoticeKey } from '../../features/nav/nav-model';
import { AUTHORITY_LEVELS, isAuthorityLevel, authorityLevelKey, type AuthorityRow } from '../../features/schemes-registry/scheme';
import { createAuthorityAction } from './actions';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  return { title: getTranslator().t('sr.title'), robots: { index: false, follow: false } };
}

const ERR = new Set(['defaultName', 'level', 'regionId', 'reason', 'elevation', 'conflict', 'invalid', 'generic']);

export default async function AuthoritiesPage({ searchParams }: { searchParams: { cursor?: string; level?: string; ok?: string; error?: string } }) {
  requireAdmin();
  const t = getTranslator();
  const level = isAuthorityLevel(searchParams.level) ? searchParams.level : undefined;

  let rows: AuthorityRow[] = []; let nextCursor: string | undefined; let notice: string | undefined;
  try {
    const res = await adminGet<AuthorityRow[]>('schemes-registry/authorities', { cursor: searchParams.cursor, level, limit: 50 });
    rows = res.data ?? [];
    nextCursor = (res.meta?.nextCursor as string | undefined) ?? undefined;
  } catch (e) { notice = t.t(`notice.${adminNoticeKey(e instanceof AdminApiError ? e.status : undefined)}`); }

  const okCreated = searchParams.ok === 'created';
  const errKey = searchParams.error && ERR.has(searchParams.error) ? searchParams.error : null;
  const cols: Column<AuthorityRow>[] = [
    { header: t.t('sr.authName'), cell: (r) => <Link href={`/schemes-registry/authorities/${encodeURIComponent(r.id)}`}>{r.defaultName}</Link> },
    { header: t.t('sr.level'), cell: (r) => t.t(`sr.lvl.${authorityLevelKey(r.level)}`) },
    { header: t.t('sr.regionId'), cell: (r) => r.regionId ?? t.t('common.dash') },
  ];
  const filterHref = (l?: string) => `/schemes-registry${l ? `?level=${encodeURIComponent(l)}` : ''}`;

  return (
    <section>
      <h1>{t.t('sr.title')}</h1>
      <p className="kv-muted">{t.t('sr.lead')}</p>
      <nav className="kv-filters" aria-label={t.t('sr.nav')}>
        <Link href="/schemes-registry" className="kv-chip is-active" aria-current="true">{t.t('sr.navAuthorities')}</Link>
        <Link href="/schemes-registry/schemes" className="kv-chip">{t.t('sr.navSchemes')}</Link>
        <Link href="/schemes-registry/calendar" className="kv-chip">{t.t('sr.navCalendar')}</Link>
      </nav>
      {okCreated && <p className="kv-success" role="status">{t.t('sr.ok.authCreated')}</p>}
      {errKey && <p className="kv-error" role="alert">{t.t(`sr.error.${errKey}`)}</p>}

      <nav className="kv-filters" aria-label={t.t('sr.filterLevel')}>
        <Link href={filterHref()} className={`kv-chip${!level ? ' is-active' : ''}`} aria-current={!level ? 'true' : undefined}>{t.t('sr.filterAll')}</Link>
        {AUTHORITY_LEVELS.map((l) => (
          <Link key={l} href={filterHref(l)} className={`kv-chip${level === l ? ' is-active' : ''}`} aria-current={level === l ? 'true' : undefined}>{t.t(`sr.lvl.${l}`)}</Link>
        ))}
      </nav>

      {notice ? <p className="kv-error" role="alert">{notice}</p> : (
        <>
          <DataTable columns={cols} rows={rows} empty={t.t('sr.authEmpty')} />
          {nextCursor && <p className="kv-pager"><Link className="kv-btn" href={`/schemes-registry?cursor=${encodeURIComponent(nextCursor)}${level ? `&level=${level}` : ''}`}>{t.t('common.nextPage')}</Link></p>}
        </>
      )}

      <details className="kv-card kv-limit-form">
        <summary className="kv-card__title">{t.t('sr.createAuth')}</summary>
        <form action={createAuthorityAction} className="kv-form">
          <label htmlFor="defaultName" className="kv-field__label">{t.t('sr.authName')}</label>
          <input id="defaultName" name="defaultName" className="kv-input" required maxLength={200} />
          <label htmlFor="level" className="kv-field__label">{t.t('sr.level')}</label>
          <select id="level" name="level" className="kv-input" defaultValue="central">{AUTHORITY_LEVELS.map((l) => <option key={l} value={l}>{t.t(`sr.lvl.${l}`)}</option>)}</select>
          <label htmlFor="regionId" className="kv-field__label">{t.t('sr.regionId')}</label>
          <input id="regionId" name="regionId" className="kv-input" placeholder={t.t('sr.regionHint')} />
          <label htmlFor="authReason" className="kv-field__label">{t.t('sr.reason')}</label>
          <input id="authReason" name="reason" className="kv-input" required minLength={3} maxLength={1000} />
          <button type="submit" className="kv-btn">{t.t('sr.createAuthSubmit')}</button>
        </form>
      </details>
    </section>
  );
}
