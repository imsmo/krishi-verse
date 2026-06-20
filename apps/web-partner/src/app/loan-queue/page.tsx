// apps/web-partner/src/app/loan-queue/page.tsx · the lender review queue (fintech/loan-applications?box=review).
// Server-gated; keyset pagination (?cursor=). The API scopes the list to this partner — RLS + partner RBAC mean
// you can never page into another lender's book. Money rendered from bigint-minor strings (Law 2). A failed call
// degrades to an empty state, never a 500.
import Link from 'next/link';
import { requirePartner } from '../../lib/partner-auth';
import { partnerClient } from '../../lib/api-client';
import { DataTable, Column } from '../../components/DataTable';
import { formatMoneyMinor, formatDate } from '@krishi-verse/i18n';

export const dynamic = 'force-dynamic';

interface AppRow {
  id: string; status: string; amountRequestedMinor: string; amountApprovedMinor: string | null;
  purposeText: string | null; createdAt?: string;
}

const STATUS_TINT: Record<string, string> = {
  submitted: '#c77700', under_review: '#1565c0', approved: '#1b7f3b', rejected: 'var(--kv-danger)',
  disbursed: '#0d47a1', withdrawn: 'var(--kv-neutral-600)',
};

export default async function LoanQueuePage({ searchParams }: { searchParams: { cursor?: string; status?: string } }) {
  requirePartner();

  let rows: AppRow[] = [];
  let nextCursor: string | undefined;
  let notice: string | undefined;
  try {
    const res = await partnerClient().request<AppRow[]>('GET', 'fintech/loan-applications', { query: { box: 'review', status: searchParams.status, cursor: searchParams.cursor, limit: 50 } });
    rows = res.data ?? [];
    nextCursor = (res.meta?.nextCursor as string | undefined) ?? undefined;
  } catch { notice = 'The loan queue is temporarily unavailable.'; }

  const columns: Column<AppRow>[] = [
    { header: 'Application', cell: (r) => <Link href={`/loan-queue/${r.id}`}>{r.id.slice(0, 8)}…</Link> },
    { header: 'Requested', cell: (r) => formatMoneyMinor(r.amountRequestedMinor, 'INR', 'en') },
    { header: 'Purpose', cell: (r) => r.purposeText ?? '—' },
    { header: 'Status', cell: (r) => <span style={{ color: STATUS_TINT[r.status] ?? 'inherit', fontWeight: 600 }}>{r.status}</span> },
    { header: 'Applied', cell: (r) => (r.createdAt ? formatDate(r.createdAt, 'en') : '—') },
  ];

  return (
    <section>
      <h1>Loan queue</h1>
      <p style={{ color: 'var(--kv-neutral-600)' }}>Applications routed to your institution for decision.</p>
      {notice ? <p className="kv-error" style={{ marginTop: 16 }}>{notice}</p> : (
        <>
          <div style={{ marginTop: 16 }}><DataTable columns={columns} rows={rows} empty="No applications waiting." /></div>
          {nextCursor && (
            <p style={{ marginTop: 16 }}>
              <Link className="kv-btn" href={`/loan-queue?cursor=${encodeURIComponent(nextCursor)}${searchParams.status ? `&status=${searchParams.status}` : ''}`}>Next page →</Link>
            </p>
          )}
        </>
      )}
    </section>
  );
}
