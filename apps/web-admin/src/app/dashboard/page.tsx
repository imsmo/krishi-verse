// apps/web-admin/src/app/dashboard/page.tsx · god-mode home. Server-gated (requireAdmin). Links to the live ops
// surfaces only; not-yet-built surfaces are shown in the Sidebar as "(soon)". All copy via i18n; no inline styles.
import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '../../lib/admin-auth';
import { getTranslator } from '../../lib/i18n';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  return { title: getTranslator().t('dashboard.title'), robots: { index: false, follow: false } };
}

export default function AdminDashboard() {
  requireAdmin();
  const t = getTranslator();
  return (
    <section>
      <h1>{t.t('dashboard.title')}</h1>
      <p className="kv-muted">{t.t('dashboard.lead')}</p>
      <div className="kv-card-grid">
        <Link href="/ai-models" className="kv-card">{t.t('dashboard.openAiModels')}</Link>
      </div>
    </section>
  );
}
