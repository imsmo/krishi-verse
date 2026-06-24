// apps/web-partner/src/app/loading.tsx · root loading boundary (covers every fetching segment unless overridden).
import { getTranslator } from '../lib/i18n';

export default function Loading() {
  const t = getTranslator();
  return <div className="kv-loading" role="status" aria-live="polite">{t.t('common.loading')}</div>;
}
