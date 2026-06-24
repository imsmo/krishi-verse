// apps/web-tenant/src/app/listings/new/loading.tsx · segment loading boundary for the new-listing page while the
// catalogue read resolves. Localized; server component.
import { getTranslator } from '../../../lib/i18n';

export default function Loading() {
  const t = getTranslator();
  return <div className="kv-loading" role="status" aria-live="polite">{t.t('common.loading')}</div>;
}
