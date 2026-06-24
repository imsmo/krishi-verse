// apps/web-admin/src/app/compliance/breaches/[id]/page.tsx · DPDP §8 breach detail + lifecycle. Server component:
// requireAdmin gates, fetches GET /v1/compliance/breaches/:id (404 → notFound). Lifecycle actions (contain →
// notify → close) are surfaced only when legal (features/compliance mirrors the breach.state machine); "notify"
// requires BOTH the regulator- and principals-notified timestamps (DPDP §8). Each is a Server-Action form with a
// mandatory audit note; admin-api requires compliance.manage + FIDO2 + step-up, so a 403 degrades to a re-auth
// notice. Categories only — no raw PII. No inline styles.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '../../../../lib/admin-auth';
import { adminGet, AdminApiError } from '../../../../lib/admin-client';
import { getTranslator } from '../../../../lib/i18n';
import { adminNoticeKey } from '../../../../features/nav/nav-model';
import { breachStatusKey, breachSeverityKey, canContainBreach, canNotifyBreach, canCloseBreach, type BreachRow } from '../../../../features/compliance/compliance';
import { updateBreachAction } from '../../actions';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  return { title: getTranslator().t('compliance.breachDetailTitle'), robots: { index: false, follow: false } };
}

const SEV_CLASS: Record<string, string> = { low: 'kv-status--muted', medium: 'kv-status--warn', high: 'kv-status--danger', critical: 'kv-status--danger' };
const OK = new Set(['contain', 'notify', 'close']);
const ERR = new Set(['action', 'note', 'notifiedAt', 'elevation', 'conflict', 'invalid', 'notFound', 'generic']);

export default async function BreachDetailPage({ params, searchParams }: { params: { id: string }; searchParams: { ok?: string; error?: string } }) {
  requireAdmin();
  const t = getTranslator();

  let breach: BreachRow | undefined; let notice: string | undefined;
  try { breach = (await adminGet<BreachRow>(`compliance/breaches/${encodeURIComponent(params.id)}`)).data; }
  catch (e) {
    if (e instanceof AdminApiError && e.status === 404) notFound();
    notice = t.t(`notice.${adminNoticeKey(e instanceof AdminApiError ? e.status : undefined)}`);
  }

  if (!breach) {
    return <section><p className="kv-backlink"><Link href="/compliance/breaches">{t.t('compliance.backBreaches')}</Link></p><p className="kv-error" role="alert">{notice}</p></section>;
  }

  const okKey = searchParams.ok && OK.has(searchParams.ok) ? searchParams.ok : null;
  const errKey = searchParams.error && ERR.has(searchParams.error) ? searchParams.error : null;
  const sev = breachSeverityKey(breach.severity);
  const st = breachStatusKey(breach.status);

  return (
    <section>
      <p className="kv-backlink"><Link href="/compliance/breaches">{t.t('compliance.backBreaches')}</Link></p>
      <h1>{breach.title}</h1>
      {okKey && <p className="kv-success" role="status">{t.t(`compliance.breachOk.${okKey}`)}</p>}
      {errKey && <p className="kv-error" role="alert">{t.t(`compliance.error.${errKey}`)}</p>}

      <dl className="kv-facts">
        <div className="kv-facts__row"><dt>{t.t('compliance.severity')}</dt><dd><span className={`kv-status ${SEV_CLASS[sev]}`}>{t.t(`compliance.sev.${sev}`)}</span></dd></div>
        <div className="kv-facts__row"><dt>{t.t('compliance.status')}</dt><dd>{t.t(`compliance.breachState.${st}`)}</dd></div>
        <div className="kv-facts__row"><dt>{t.t('compliance.affectedTenant')}</dt><dd>{breach.affectedTenantId ?? t.t('common.dash')}</dd></div>
        <div className="kv-facts__row"><dt>{t.t('compliance.affectedCount')}</dt><dd>{breach.affectedCount.toLocaleString()}</dd></div>
        <div className="kv-facts__row"><dt>{t.t('compliance.detectedAt')}</dt><dd>{breach.detectedAt ?? t.t('common.dash')}</dd></div>
        <div className="kv-facts__row"><dt>{t.t('compliance.containedAt')}</dt><dd>{breach.containedAt ?? t.t('common.dash')}</dd></div>
        <div className="kv-facts__row"><dt>{t.t('compliance.regulatorNotifiedAt')}</dt><dd>{breach.regulatorNotifiedAt ?? t.t('common.dash')}</dd></div>
        <div className="kv-facts__row"><dt>{t.t('compliance.principalsNotifiedAt')}</dt><dd>{breach.principalsNotifiedAt ?? t.t('common.dash')}</dd></div>
        <div className="kv-facts__row"><dt>{t.t('compliance.closedAt')}</dt><dd>{breach.closedAt ?? t.t('common.dash')}</dd></div>
        <div className="kv-facts__row"><dt>{t.t('compliance.resolutionNote')}</dt><dd>{breach.resolutionNote ?? t.t('common.dash')}</dd></div>
      </dl>

      <h2>{t.t('compliance.breachLifecycle')}</h2>
      {canContainBreach(st) || canNotifyBreach(st) || canCloseBreach(st) ? (
        <div className="kv-action-cards">
          {canContainBreach(st) && (
            <form action={updateBreachAction} className="kv-card kv-action-card">
              <input type="hidden" name="id" value={breach.id} /><input type="hidden" name="action" value="contain" />
              <label className="kv-field__label">{t.t('compliance.note')}</label>
              <input name="note" className="kv-input" required minLength={3} maxLength={2000} />
              <button type="submit" className="kv-btn">{t.t('compliance.contain')}</button>
            </form>
          )}
          {canNotifyBreach(st) && (
            <form action={updateBreachAction} className="kv-card kv-action-card">
              <input type="hidden" name="id" value={breach.id} /><input type="hidden" name="action" value="notify" />
              <p className="kv-field__hint">{t.t('compliance.notifyHint')}</p>
              <label className="kv-field__label">{t.t('compliance.regulatorNotifiedAt')}</label>
              <input name="regulatorNotifiedAt" className="kv-input" required placeholder={t.t('compliance.isoHint')} />
              <label className="kv-field__label">{t.t('compliance.principalsNotifiedAt')}</label>
              <input name="principalsNotifiedAt" className="kv-input" required placeholder={t.t('compliance.isoHint')} />
              <label className="kv-field__label">{t.t('compliance.note')}</label>
              <input name="note" className="kv-input" required minLength={3} maxLength={2000} />
              <button type="submit" className="kv-btn">{t.t('compliance.notify')}</button>
            </form>
          )}
          {canCloseBreach(st) && (
            <form action={updateBreachAction} className="kv-card kv-action-card">
              <input type="hidden" name="id" value={breach.id} /><input type="hidden" name="action" value="close" />
              <label className="kv-field__label">{t.t('compliance.note')}</label>
              <input name="note" className="kv-input" required minLength={3} maxLength={2000} />
              <button type="submit" className="kv-btn kv-btn--danger">{t.t('compliance.close')}</button>
            </form>
          )}
        </div>
      ) : <p className="kv-muted">{t.t('compliance.breachClosed')}</p>}
    </section>
  );
}
