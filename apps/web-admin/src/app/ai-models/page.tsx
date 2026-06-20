// apps/web-admin/src/app/ai-models/page.tsx · god-mode AI model registry. Server component: requireAdmin gates,
// adminGet hits admin-api GET /v1/ai/models (owner perm enforced server-side). Keyset pagination (?cursor=).
// Degrade-never-die: a 401 redirects to login; a 403 surfaces the step-up prompt; any other failure shows an
// empty state rather than a 500. Read-only list — mutations (register/promote/tune) require FIDO2 + step-up and
// live behind dedicated flows, not built in this slice.
import Link from 'next/link';
import { requireAdmin } from '../../lib/admin-auth';
import { adminGet, AdminApiError } from '../../lib/admin-client';
import { DataTable, Column } from '../../components/DataTable';

export const dynamic = 'force-dynamic';

interface ModelRow {
  id: string; code: string; version: string; provider: string | null;
  status: string; confidenceThreshold: number | null; createdAt?: string;
}

const STATUS_TINT: Record<string, string> = {
  shadow: 'var(--kv-neutral-600)', canary: '#c77700', live: '#1b7f3b', retired: 'var(--kv-neutral-600)',
};

export default async function AiModelsPage({ searchParams }: { searchParams: { cursor?: string; status?: string } }) {
  requireAdmin();

  let rows: ModelRow[] = [];
  let nextCursor: string | undefined;
  let notice: string | undefined;
  try {
    const res = await adminGet<ModelRow[]>('ai/models', { cursor: searchParams.cursor, status: searchParams.status, limit: 50 });
    rows = res.data ?? [];
    nextCursor = (res.meta?.nextCursor as string | undefined) ?? undefined;
  } catch (e) {
    if (e instanceof AdminApiError && e.needsElevation) notice = 'Hardware-key / step-up re-authentication required to view the model registry.';
    else if (e instanceof AdminApiError && e.unauthorized) notice = 'Session expired. Sign in again.';
    else notice = 'The model registry is temporarily unavailable.';
  }

  const columns: Column<ModelRow>[] = [
    { header: 'Code', cell: (r) => <Link href={`/ai-models/${r.id}`}>{r.code}</Link> },
    { header: 'Version', cell: (r) => r.version },
    { header: 'Provider', cell: (r) => r.provider ?? '—' },
    { header: 'Status', cell: (r) => <span style={{ color: STATUS_TINT[r.status] ?? 'inherit', fontWeight: 600 }}>{r.status}</span> },
    { header: 'Threshold', cell: (r) => (r.confidenceThreshold == null ? '—' : r.confidenceThreshold.toFixed(4)) },
  ];

  return (
    <section>
      <h1>AI model registry</h1>
      <p style={{ color: 'var(--kv-neutral-600)' }}>Cross-tenant inference models. Promotion and threshold tuning are consequential and require step-up elevation.</p>
      {notice ? <p className="kv-error" style={{ marginTop: 16 }}>{notice}</p> : (
        <>
          <div style={{ marginTop: 16 }}><DataTable columns={columns} rows={rows} empty="No models registered." /></div>
          {nextCursor && (
            <p style={{ marginTop: 16 }}>
              <Link className="kv-btn" href={`/ai-models?cursor=${encodeURIComponent(nextCursor)}${searchParams.status ? `&status=${searchParams.status}` : ''}`}>Next page →</Link>
            </p>
          )}
        </>
      )}
    </section>
  );
}
