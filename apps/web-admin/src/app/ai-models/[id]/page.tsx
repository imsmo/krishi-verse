// apps/web-admin/src/app/ai-models/[id]/page.tsx · god-mode model detail + fairness report. Hits admin-api
// GET /v1/ai/models/:id/fairness, which returns the model, the stored monthly fairness audit, and a fresh 30-day
// roll-up of the inference log (total / overridden / low-confidence + override rate). Read-only and audited
// server-side (viewing cross-tenant data is itself logged). Degrade-never-die: 401→login, 403→step-up prompt,
// not-found→notFound(), transient→inline notice.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '../../../lib/admin-auth';
import { adminGet, AdminApiError } from '../../../lib/admin-client';

export const dynamic = 'force-dynamic';

interface FairnessReport {
  model: { id: string; code: string; version: string; provider: string | null; status: string; confidenceThreshold: number | null; createdAt?: string };
  storedFairnessAudit: Record<string, unknown> | null;
  recent: { window: string; total: number; overridden: number; lowConfidence: number; overrideRate: number };
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="kv-card" style={{ minWidth: 160 }}>
      <div style={{ color: 'var(--kv-neutral-600)', fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  );
}

export default async function AiModelDetailPage({ params }: { params: { id: string } }) {
  requireAdmin();

  let report: FairnessReport | undefined;
  let notice: string | undefined;
  try {
    const res = await adminGet<FairnessReport>(`ai/models/${params.id}/fairness`);
    report = res.data;
  } catch (e) {
    if (e instanceof AdminApiError && e.status === 404) notFound();
    else if (e instanceof AdminApiError && e.needsElevation) notice = 'Hardware-key / step-up re-authentication required to view fairness data.';
    else if (e instanceof AdminApiError && e.unauthorized) notice = 'Session expired. Sign in again.';
    else notice = 'The fairness report is temporarily unavailable.';
  }

  if (!report) {
    return (
      <section>
        <p style={{ marginBottom: 16 }}><Link href="/ai-models">← Model registry</Link></p>
        <p className="kv-error">{notice}</p>
      </section>
    );
  }

  const m = report.model;
  const r = report.recent;
  return (
    <section>
      <p style={{ marginBottom: 16 }}><Link href="/ai-models">← Model registry</Link></p>
      <h1>{m.code} <span style={{ color: 'var(--kv-neutral-600)', fontWeight: 400 }}>v{m.version}</span></h1>
      <p style={{ color: 'var(--kv-neutral-600)' }}>
        Status <strong>{m.status}</strong> · Provider {m.provider ?? '—'} · Routing threshold {m.confidenceThreshold == null ? '—' : m.confidenceThreshold.toFixed(4)}
      </p>

      <h2 style={{ marginTop: 24 }}>Inference roll-up ({r.window})</h2>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12 }}>
        <Stat label="Inferences" value={r.total.toLocaleString()} />
        <Stat label="Human-overridden" value={r.overridden.toLocaleString()} />
        <Stat label="Override rate" value={`${(r.overrideRate * 100).toFixed(2)}%`} />
        <Stat label="Low-confidence (<0.5)" value={r.lowConfidence.toLocaleString()} />
      </div>

      <h2 style={{ marginTop: 24 }}>Stored fairness audit</h2>
      {report.storedFairnessAudit
        ? <pre className="kv-card" style={{ overflowX: 'auto', whiteSpace: 'pre-wrap' }}>{JSON.stringify(report.storedFairnessAudit, null, 2)}</pre>
        : <p style={{ color: 'var(--kv-neutral-600)' }}>No fairness audit recorded yet for this model.</p>}
    </section>
  );
}
