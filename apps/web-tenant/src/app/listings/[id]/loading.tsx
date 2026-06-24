// apps/web-tenant/src/app/listings/[id]/loading.tsx · segment loading boundary while the owner listing resolves.
import { getTranslator } from '../../../lib/i18n';

export default function Loading() {
  const t = getTranslator();
  return <div className="kv-loading" role="status" aria-live="polite">{t.t('common.loading')}</div>;
}
