// apps/web-tenant/src/app/layout.tsx · console shell (sidebar nav + content). Server component. The nav is
// static; each page server-side gates on the session (requireSession) and the API re-enforces RBAC per call.
import type { Metadata } from 'next';
import Link from 'next/link';
import '../styles/globals.css';
import { env } from '../lib/env';
import { isAuthenticated } from '../lib/auth';

export const metadata: Metadata = { title: { default: env.appName, template: `%s · ${env.appName}` }, robots: { index: false, follow: false } };

// Built routes only. The broader console surface (disputes, payouts, support, settings, …) is mapped in the
// app README as not-yet-built — nav never links to a route that doesn't exist.
const NAV = [['/dashboard', 'Dashboard'], ['/listings', 'Listings'], ['/orders', 'Orders']];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const authed = isAuthenticated();
  return (
    <html lang="en"><body>
      {authed ? (
        <div className="kv-shell">
          <nav className="kv-sidebar">
            <Link href="/dashboard" className="kv-brand">{env.appName}</Link>
            {NAV.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
            <form action="/api/session" method="post" style={{ marginTop: 24 }}>
              <input type="hidden" name="_action" value="logout" /><button className="kv-btn" style={{ background: 'var(--kv-neutral-600)' }}>Sign out</button>
            </form>
          </nav>
          <main className="kv-content">{children}</main>
        </div>
      ) : <main className="kv-content" style={{ margin: '0 auto' }}>{children}</main>}
    </body></html>
  );
}
