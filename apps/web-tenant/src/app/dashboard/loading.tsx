// apps/web-tenant/src/app/dashboard/loading.tsx · loading boundary while the dashboard resolves.
import { getTranslator } from '../../lib/i18n';

export default function Loading() {
  const t = getTranslator();
  return <div className="kv-loading" role="status" aria-live="polite">{t.t('common.loading')}</div>;
}
