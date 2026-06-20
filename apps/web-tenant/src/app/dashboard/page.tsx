// apps/web-tenant/src/app/dashboard/page.tsx · console home. Server-gated (requireSession) and greets the
// authenticated staff member from the API's /auth/me. If the profile call fails the page still renders (Law 12).
import Link from 'next/link';
import { requireSession } from '../../lib/auth';
import { tenantClient } from '../../lib/api-client';
import type { UserProfile } from '@krishi-verse/sdk-js';

export const dynamic = 'force-dynamic';   // per-request (session-scoped); never statically cached

export default async function DashboardPage() {
  requireSession();
  let me: UserProfile | null = null;
  try { me = await tenantClient().auth.me(); } catch { me = null; }
  return (
    <section>
      <h1>Dashboard</h1>
      <p style={{ color: 'var(--kv-neutral-600)' }}>{me ? `Signed in as ${me.displayName ?? me.id} · roles: ${me.roles.join(', ')}` : 'Welcome back.'}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 16, marginTop: 16 }}>
        {[['/listings', 'Manage listings'], ['/orders', 'View orders']].map(([href, label]) => (
          <Link key={href} href={href} className="kv-card">{label} →</Link>
        ))}
      </div>
    </section>
  );
}
