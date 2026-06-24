// apps/web-admin/src/app/compliance/dsr/[id]/page.tsx · DSR detail + decision. Server component: requireAdmin
// gates, fetches GET /v1/compliance/dsr/:id (404 → notFound). Decisions (start / complete / reject) are surfaced
// only when legal (features/compliance mirrors the dsr.state machine; an erasure can't complete inside its 90-day
// cooling window — admin-api enforces, surfaced as a 409 message). Each is a Server-Action form carrying a
// mandatory audit resolution; admin-api requires compliance.manage + FIDO2 + step-up, so a 403 degrades to a
// re-auth notice. PII-minimal. No inline styles.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '../../../../lib/admin-auth';
import { adminGet, AdminApiError } from '../../../../lib/admin-client';
import { getTranslator } from '../../../../lib/i18n';
import { adminNoticeKey } from '../../../../features/nav/nav-model';
import { dsrStatusKey, canStartDsr, canCompleteDsr, canRejectDsr, type DsrRow } from '../../../../features/compliance/compliance';
import { updateDsrAction } from '../../actions';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  return { title: getTranslator().t('compliance.dsrDetailTitle'), robots: { index: false, follow: false } };
}

const OK = new Set(['start', 'complete', 'reject']);
const ERR = new Set(['action', 'resolution', 'exportMediaId', 'elevation', 'conflict', 'invalid', 'notFound', 'generic']);

export default async function DsrDetailPage({ params, searchParams }: { params: { id: string }; searchParams: { ok?: string; error?: string } }) {
  requireAdmin();
  const t = getTranslator();

  let dsr: DsrRow | undefined; let notice: string | undefined;
  try { dsr = (await adminGet<DsrRow>(`compliance/dsr/${encodeURIComponent(params.id)}`)).data; }
  catch (e) {
    if (e instanceof AdminApiError && e.status === 404) notFound();
    notice = t.t(`notice.${adminNoticeKey(e instanceof AdminApiError ? e.status : undefined)}`);
  }

  if (!dsr) {
    return <section><p className="kv-backlink"><Link href="/compliance">{t.t('compliance.back')}</Link></p><p className="kv-error" role="alert">{notice}</p></section>;
  }

  const okKey = searchParams.ok && OK.has(searchParams.ok) ? searchParams.ok : null;
  const errKey = searchParams.error && ERR.has(searchParams.error) ? searchParams.error : null;
  const s = dsrStatusKey(dsr.status);
  const isErasure = dsr.requestType === 'erasure';

  return (
    <section>
      <p className="kv-backlink"><Link href="/compliance">{t.t('compliance.back')}</Link></p>
      <h1>{t.t('compliance.dsrDetailTitle')}</h1>
      {okKey && <p className="kv-success" role="status">{t.t(`compliance.dsrOk.${okKey}`)}</p>}
      {errKey && <p className="kv-error" role="alert">{t.t(`compliance.error.${errKey}`)}</p>}

      <dl className="kv-facts">
        <div className="kv-facts__row"><dt>{t.t('compliance.requestType')}</dt><dd>{t.t(`compliance.reqType.${dsr.requestType}`)}</dd></div>
        <div className="kv-facts__row"><dt>{t.t('compliance.status')}</dt><dd>{t.t(`compliance.dsrState.${s}`)}</dd></div>
        <div className="kv-facts__row"><dt>{t.t('compliance.subject')}</dt><dd>{dsr.userId}</dd></div>
        <div className="kv-facts__row"><dt>{t.t('compliance.coolingEndsAt')}</dt><dd>{dsr.coolingEndsAt ?? t.t('common.dash')}</dd></div>
        <div className="kv-facts__row"><dt>{t.t('compliance.exportMedia')}</dt><dd>{dsr.exportMediaId ?? t.t('common.dash')}</dd></div>
        <div className="kv-facts__row"><dt>{t.t('compliance.resolution')}</dt><dd>{dsr.resolution ?? t.t('common.dash')}</dd></div>
        <div className="kv-facts__row"><dt>{t.t('compliance.createdAt')}</dt><dd>{dsr.createdAt ?? t.t('common.dash')}</dd></div>
      </dl>

      <h2>{t.t('compliance.dsrActions')}</h2>
      <p className="kv-field__hint">{t.t('compliance.dsrActionsNote')}</p>
      {canStartDsr(s) || canCompleteDsr(s) || canRejectDsr(s) ? (
        <div className="kv-action-cards">
          {canStartDsr(s) && <DsrForm id={dsr.id} action="start" verb={t.t('compliance.dsrStart')} t={t} />}
          {canCompleteDsr(s) && <DsrForm id={dsr.id} action="complete" verb={t.t('compliance.dsrComplete')} t={t} withMedia={dsr.requestType === 'access' || dsr.requestType === 'portability'} hint={isErasure ? t.t('compliance.coolingHint') : undefined} />}
          {canRejectDsr(s) && <DsrForm id={dsr.id} action="reject" verb={t.t('compliance.dsrReject')} t={t} danger />}
        </div>
      ) : <p className="kv-muted">{t.t('compliance.dsrTerminal')}</p>}
    </section>
  );
}

function DsrForm({ id, action, verb, t, withMedia, hint, danger }: { id: string; action: string; verb: string; t: ReturnType<typeof getTranslator>; withMedia?: boolean; hint?: string; danger?: boolean }) {
  return (
    <form action={updateDsrAction} className="kv-card kv-action-card">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="action" value={action} />
      {hint && <p className="kv-field__hint">{hint}</p>}
      <label className="kv-field__label">{t.t('compliance.resolution')}</label>
      <input name="resolution" className="kv-input" required minLength={3} maxLength={2000} />
      {withMedia && (
        <>
          <label className="kv-field__label">{t.t('compliance.exportMedia')}</label>
          <input name="exportMediaId" className="kv-input" placeholder={t.t('compliance.exportMediaHint')} />
        </>
      )}
      <button type="submit" className={`kv-btn${danger ? ' kv-btn--danger' : ''}`}>{verb}</button>
    </form>
  );
}
