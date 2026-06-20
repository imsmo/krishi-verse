// apps/web-admin/src/app/layout.tsx · god-mode console shell. noindex (never crawlable). Red brand signals the
// elevated realm. Nav lists the platform-ops surfaces; pages whose admin-api module isn't built yet are marked.
import type { Metadata } from 'next';
import Link from 'next/link';
import '../styles/globals.css';
import { env } from '../lib/env';
import { isAdminAuthenticated } from '../lib/admin-auth';

export const metadata: Metadata = { title: { default: env.appName, template: `%s · ${env.appName}` }, robots: { index: false, follow: false } };

const NAV: Array<[string, string, boolean]> = [
  ['/dashboard', 'Dashboard', true], ['/ai-models', 'AI Models', true],
  ['/tenants', 'Tenants', false], ['/feature-flags', 'Feature Flags', false],
  ['/recon-monitor', 'Recon Monitor', false], ['/audit-log', 'Audit Log', false],
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const authed = isAdminAuthenticated();
  return (
    <html lang="en"><body>
      {authed ? (
        <div className="kv-shell">
          <nav className="kv-sidebar">
            <Link href="/dashboard" className="kv-brand">{env.appName} · GOD MODE</Link>
            {NAV.map(([href, label, live]) => live
              ? <Link key={href} href={href}>{label}</Link>
              : <span key={href} style={{ display: 'block', padding: '10px 12px', color: 'var(--kv-neutral-600)' }} title="admin-api module not built yet">{label} (soon)</span>)}
            <form action="/api/session" method="post" style={{ marginTop: 24 }}><input type="hidden" name="_action" value="logout" /><button className="kv-btn" style={{ background: 'var(--kv-neutral-600)' }}>Sign out</button></form>
          </nav>
          <main className="kv-content">{children}</main>
        </div>
      ) : <main className="kv-content" style={{ margin: '0 auto' }}>{children}</main>}
    </body></html>
  );
}
