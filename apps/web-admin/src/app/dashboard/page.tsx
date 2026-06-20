// apps/web-admin/src/app/dashboard/page.tsx · god-mode home. Server-gated (requireAdmin). Links to the live
// ops surfaces; the data pages call admin-api directly.
import Link from 'next/link';
import { requireAdmin } from '../../lib/admin-auth';

export const dynamic = 'force-dynamic';

export default function AdminDashboard() {
  requireAdmin();
  return (
    <section>
      <h1>Platform operations</h1>
      <p style={{ color: 'var(--kv-neutral-600)' }}>God-mode. Every action here is audited; sensitive ones require step-up re-auth.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 16, marginTop: 16 }}>
        <Link href="/ai-models" className="kv-card">AI model registry →</Link>
        <span className="kv-card" style={{ color: 'var(--kv-neutral-600)' }}>Tenants (soon)</span>
        <span className="kv-card" style={{ color: 'var(--kv-neutral-600)' }}>Recon monitor (soon)</span>
      </div>
    </section>
  );
}
