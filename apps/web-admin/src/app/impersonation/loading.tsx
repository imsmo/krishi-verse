// apps/web-admin/src/app/impersonation/loading.tsx · loading boundary for the act-as console + /impersonation/** segments.
import { getTranslator } from '../../lib/i18n';

export default function Loading() {
  const t = getTranslator();
  return <div className="kv-loading" role="status" aria-live="polite">{t.t('common.loading')}</div>;
}
