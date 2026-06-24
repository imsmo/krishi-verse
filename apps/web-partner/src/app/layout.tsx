// apps/web-partner/src/app/layout.tsx · partner-portal shell (server component, noindex). Renders the persona-aware
// Sidebar chrome only when a session cookie is present (otherwise the bare login surface). Each page still gates
// server-side via requirePartner and the platform API re-enforces partner RBAC + RLS per call. No inline styles.
import type { Metadata } from 'next';
import '../styles/globals.css';
import { env } from '../lib/env';
import { getTranslator } from '../lib/i18n';
import { isAuthenticated } from '../lib/partner-auth';
import { Sidebar } from '../components/Sidebar';

export const metadata: Metadata = {
  title: { default: env.appName, template: `%s · ${env.appName}` },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const t = getTranslator();
  const authed = isAuthenticated();
  return (
    <html lang="en">
      <body>
        <a href="#main" className="kv-skip">{t.t('common.backToDashboard')}</a>
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
