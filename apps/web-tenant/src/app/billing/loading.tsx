// apps/web-tenant/src/app/billing/loading.tsx · loading boundary while billing data resolves.
import { getTranslator } from '../../lib/i18n';

export default function Loading() {
  const t = getTranslator();
  return <div className="kv-loading" role="status" aria-live="polite">{t.t('common.loading')}</div>;
}
