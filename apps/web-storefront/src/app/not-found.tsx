// apps/web-storefront/src/app/not-found.tsx · the global 404 boundary. Server component; localized. Rendered by
// notFound() (e.g. a missing listing/tenant) AND by any not-yet-built route (e.g. /login, /cart before their
// wave) — a friendly localized page, never a crash (degrade, never die).
import Link from 'next/link';
import { getTranslator } from '../lib/i18n';

export default function NotFound() {
  const t = getTranslator();
  return (
    <section className="kv-empty-state">
      <h1>{t.t('common.notFoundTitle')}</h1>
      <p>{t.t('common.notFoundBody')}</p>
      <Link href="/" className="kv-btn">{t.t('common.backHome')}</Link>
    </section>
  );
}
