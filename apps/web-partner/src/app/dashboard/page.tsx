// apps/web-partner/src/app/dashboard/page.tsx · partner home. Pipeline KPIs rolled up from the lender review
// queue (fintech/loan-applications?box=review). Server-gated (requirePartner); the API only returns applications
// routed to this partner. Degrade-never-die: an SDK failure shows zeroes + a notice, never a 500. Money is shown
// from bigint-minor strings via formatMoneyMinor (Law 2 — no float on the client).
import Link from 'next/link';
import { requirePartner } from '../../lib/partner-auth';
import { partnerClient } from '../../lib/api-client';
import { formatMoneyMinor } from '@krishi-verse/i18n';

export const dynamic = 'force-dynamic';

interface AppRow { id: string; status: string; amountRequestedMinor: string; amountApprovedMinor: string | null; }

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="kv-card" style={{ minWidth: 180 }}>
      <div style={{ color: 'var(--kv-neutral-600)', fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  );
}

export default async function PartnerDashboard() {
  requirePartner();

  let rows: AppRow[] = [];
  let notice: string | undefined;
  try {
    const res = await partnerClient().request<AppRow[]>('GET', 'fintech/loan-applications', { query: { box: 'review', limit: 100 } });
    rows = res.data ?? [];
  } catch { notice = 'The pipeline is temporarily unavailable. Showing no data.'; }

  const awaiting = rows.filter((r) => r.status === 'submitted' || r.status === 'under_review').length;
  const approved = rows.filter((r) => r.status === 'approved').length;
  const pendingExposureMinor = rows
    .filter((r) => r.status === 'submitted' || r.status === 'under_review')
    .reduce((sum, r) => sum + BigInt(r.amountRequestedMinor || '0'), 0n);

  return (
    <section>
      <h1>Partner overview</h1>
      <p style={{ color: 'var(--kv-neutral-600)' }}>Applications routed to your institution. You only see consented data.</p>
      {notice && <p className="kv-error" style={{ marginTop: 12 }}>{notice}</p>}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 16 }}>
        <Stat label="Awaiting decision" value={awaiting} />
        <Stat label="Approved (cooling-off)" value={approved} />
        <Stat label="Pending exposure (requested)" value={formatMoneyMinor(pendingExposureMinor.toString(), 'INR', 'en')} />
      </div>
      <p style={{ marginTop: 24 }}><Link className="kv-btn" href="/loan-queue">Open loan queue →</Link></p>
    </section>
  );
}
