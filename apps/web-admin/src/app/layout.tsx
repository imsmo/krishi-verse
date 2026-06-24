// apps/web-admin/src/app/layout.tsx · god-mode console shell. noindex (never crawlable). Renders the red-brand
// Sidebar chrome only when an admin session cookie is present (otherwise the bare login surface). Each page still
// gates server-side via requireAdmin and admin-api re-enforces owner-RBAC + step-up per call. No inline styles.
import type { Metadata } from 'next';
import '../styles/globals.css';
import { env } from '../lib/env';
import { getTranslator } from '../lib/i18n';
import { isAdminAuthenticated } from '../lib/admin-auth';
import { Sidebar } from '../components/Sidebar';

export const metadata: Metadata = {
  title: { default: env.appName, template: `%s · ${env.appName}` },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const t = getTranslator();
  const authed = isAdminAuthenticated();
  return (
    <html lang="en">
      <body>
        <a href="#main" className="kv-skip">{t.t('nav.skipToContent')}</a>
        {authed ? (
          <div className="kv-shell">
            <Sidebar />
            <main className="kv-content" id="main">{children}</main>
          </div>
        ) : (
          <main className="kv-content kv-content--bare" id="main">{children}</main>
        )}
      </body>
    </html>
  );
}
