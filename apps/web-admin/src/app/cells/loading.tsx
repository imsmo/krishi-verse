// apps/web-admin/src/app/cells/loading.tsx · loading boundary for the cells console + /cells/** segments.
import { getTranslator } from '../../lib/i18n';

export default function Loading() {
  const t = getTranslator();
  return <div className="kv-loading" role="status" aria-live="polite">{t.t('common.loading')}</div>;
}
