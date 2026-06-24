// apps/web-tenant/src/app/layout.tsx · console shell. Server component. Sets <html lang/dir> from the active
// locale; renders the Sidebar chrome only when a session cookie is present (otherwise the bare login surface).
// Every page is noindex (authenticated app, no SEO surface). Each page still gates server-side via requireSession
// and the API re-enforces RBAC per call.
import type { Metadata } from 'next';
import '../styles/globals.css';
import { env } from '../lib/env';
import { getLanguageDef, getTranslator } from '../lib/i18n';
import { hasSessionCookie } from '../lib/auth';
import { Sidebar } from '../components/Sidebar';

export const metadata: Metadata = {
  title: { default: env.appName, template: `%s · ${env.appName}` },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = getLanguageDef();
  const t = getTranslator();
  const authed = hasSessionCookie();
  return (
    <html lang={lang.code} dir={lang.dir}>
      <body>
        <a href="#main" className="kv-skip">{t.t('common.skipToContent')}</a>
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
