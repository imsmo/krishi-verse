// apps/web-admin/src/app/schemes-registry/authorities/[id]/page.tsx · authority detail + edit + change history.
// Server component: requireAdmin gates, fetches GET /v1/schemes-registry/authorities/:id (404 → notFound) and GET
// :id/history (degrades independently). Edit (PATCH :id — name/level/region) is a Server-Action form with a
// mandatory audit reason. Degrade-never-die. No inline styles.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '../../../../lib/admin-auth';
import { adminGet, AdminApiError } from '../../../../lib/admin-client';
import { DataTable, Column } from '../../../../components/DataTable';
import { getTranslator } from '../../../../lib/i18n';
import { adminNoticeKey } from '../../../../features/nav/nav-model';
import { AUTHORITY_LEVELS, authorityLevelKey, type AuthorityRow, type SchemeChangeRow } from '../../../../features/schemes-registry/scheme';
import { updateAuthorityAction } from '../../actions';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  return { title: getTranslator().t('sr.authDetailTitle'), robots: { index: false, follow: false } };
}

const OK = new Set(['created', 'updated']);
const ERR = new Set(['defaultName', 'level', 'regionId', 'reason', 'elevation', 'conflict', 'invalid', 'notFound', 'generic']);

export default async function AuthorityDetailPage({ params, searchParams }: { params: { id: string }; searchParams: { ok?: string; error?: string } }) {
  requireAdmin();
  const t = getTranslator();

  let auth: AuthorityRow | undefined; let notice: string | undefined;
  try { auth = (await adminGet<AuthorityRow>(`schemes-registry/authorities/${encodeURIComponent(params.id)}`)).data; }
  catch (e) {
    if (e instanceof AdminApiError && e.status === 404) notFound();
    notice = t.t(`notice.${adminNoticeKey(e instanceof AdminApiError ? e.status : undefined)}`);
  }

  let history: SchemeChangeRow[] = [];
  try { history = (await adminGet<SchemeChangeRow[]>(`schemes-registry/authorities/${encodeURIComponent(params.id)}/history`, { limit: 50 })).data ?? []; } catch { /* degrade */ }

  if (!auth) {
    return <section><p className="kv-backlink"><Link href="/schemes-registry">{t.t('sr.back')}</Link></p><p className="kv-error" role="alert">{notice}</p></section>;
  }

  const okKey = searchParams.ok && OK.has(searchParams.ok) ? searchParams.ok : null;
  const errKey = searchParams.error && ERR.has(searchParams.error) ? searchParams.error : null;
  const lvl = authorityLevelKey(auth.level);
  const histCols: Column<SchemeChangeRow>[] = [
    { header: t.t('sr.histAction'), cell: (h) => h.action },
    { header: t.t('sr.histReason'), cell: (h) => h.reason },
    { header: t.t('sr.histWhen'), cell: (h) => h.createdAt ?? t.t('common.dash') },
  ];

  return (
    <section>
      <p className="kv-backlink"><Link href="/schemes-registry">{t.t('sr.back')}</Link></p>
      <h1>{auth.defaultName}</h1>
      {okKey && <p className="kv-success" role="status">{t.t('sr.ok.authUpdated')}</p>}
      {errKey && <p className="kv-error" role="alert">{t.t(`sr.error.${errKey}`)}</p>}

      <dl className="kv-facts">
        <div className="kv-facts__row"><dt>{t.t('sr.level')}</dt><dd>{t.t(`sr.lvl.${lvl}`)}</dd></div>
        <div className="kv-facts__row"><dt>{t.t('sr.regionId')}</dt><dd>{auth.regionId ?? t.t('common.dash')}</dd></div>
      </dl>

      <details className="kv-card kv-limit-form">
        <summary className="kv-card__title">{t.t('sr.editAuth')}</summary>
        <form action={updateAuthorityAction} className="kv-form">
          <input type="hidden" name="id" value={auth.id} />
          <label className="kv-field__label">{t.t('sr.authName')}</label>
          <input name="defaultName" className="kv-input" required maxLength={200} defaultValue={auth.defaultName} />
          <label className="kv-field__label">{t.t('sr.level')}</label>
          <select name="level" className="kv-input" defaultValue={lvl}>{AUTHORITY_LEVELS.map((l) => <option key={l} value={l}>{t.t(`sr.lvl.${l}`)}</option>)}</select>
          <label className="kv-field__label">{t.t('sr.regionId')}</label>
          <input name="regionId" className="kv-input" defaultValue={auth.regionId ?? ''} placeholder={t.t('sr.regionHint')} />
          <label className="kv-field__label">{t.t('sr.reason')}</label>
          <input name="reason" className="kv-input" required minLength={3} maxLength={1000} />
          <button type="submit" className="kv-btn">{t.t('sr.save')}</button>
        </form>
      </details>

      <h2>{t.t('sr.historyHeading')}</h2>
      <DataTable columns={histCols} rows={history} empty={t.t('sr.noHistory')} />
    </section>
  );
}
