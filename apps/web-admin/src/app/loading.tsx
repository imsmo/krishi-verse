// apps/web-admin/src/app/loading.tsx · root loading boundary for the god-mode console.
import { getTranslator } from '../lib/i18n';

export default function Loading() {
  const t = getTranslator();
  return <div className="kv-loading" role="status" aria-live="polite">{t.t('common.loading')}</div>;
}
