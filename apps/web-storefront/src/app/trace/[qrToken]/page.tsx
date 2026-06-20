// apps/web-storefront/src/app/trace/[qrToken]/page.tsx · the PUBLIC farm-to-fork QR landing (PRD §16.3). A
// consumer scans the QR on a pack → this page SSRs the provenance via the SDK's anonymous traceability.scan
// (the API returns a curated, NON-PII projection through the SECURITY DEFINER trace_scan function). No auth, no
// PII rendered. SEO-indexed (it's a public trust surface). An unknown/disabled token → 404, never an error page.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { formatDate } from '@krishi-verse/i18n';
import type { TraceProvenance } from '@krishi-verse/sdk-js';
import { SdkError } from '@krishi-verse/sdk-js';
import { publicClient } from '../../../lib/api-client';

export const revalidate = 300;

async function load(qrToken: string): Promise<TraceProvenance | null> {
  try { return await publicClient().traceability.scan(qrToken); }
  catch (e) { if (e instanceof SdkError && (e.isNotFound || e.code === 'TRACE_SCAN_NOT_FOUND')) return null; throw e; }
}

export async function generateMetadata({ params }: { params: { qrToken: string } }): Promise<Metadata> {
  const p = await load(params.qrToken);
  return p ? { title: 'Farm-to-fork provenance', description: 'Verified journey of this produce, recorded on Krishi-Verse.' } : { title: 'Provenance not found', robots: { index: false } };
}

export default async function TraceScanPage({ params }: { params: { qrToken: string } }) {
  const p = await load(params.qrToken);
  if (!p) notFound();
  return (
    <article>
      <h1>Farm-to-fork journey</h1>
      <p style={{ color: 'var(--kv-neutral-600)' }}>
        This produce&apos;s recorded journey {p.anchored ? '— tamper-anchored ✓' : ''}. Registered {formatDate(p.createdAt)}.
      </p>
      {p.events.length === 0 ? <p>No journey events recorded yet.</p> : (
        <ol style={{ listStyle: 'none', padding: 0 }}>
          {p.events.map((e, i) => (
            <li key={i} className="kv-trace__event">
              <strong style={{ textTransform: 'capitalize' }}>{e.eventCode.replace(/_/g, ' ')}</strong>
              <span style={{ color: 'var(--kv-neutral-600)', marginLeft: 8 }}>{formatDate(e.at, 'en', { dateStyle: 'medium', timeStyle: 'short' })}</span>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}
