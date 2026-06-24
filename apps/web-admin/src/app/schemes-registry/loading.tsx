// apps/web-admin/src/app/schemes-registry/loading.tsx · loading boundary for the schemes-registry console + /schemes-registry/** segments.
import { getTranslator } from '../../lib/i18n';

export default function Loading() {
  const t = getTranslator();
  return <div className="kv-loading" role="status" aria-live="polite">{t.t('common.loading')}</div>;
}
