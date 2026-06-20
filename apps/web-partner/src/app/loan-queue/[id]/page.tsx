// apps/web-partner/src/app/loan-queue/[id]/page.tsx · application detail + lender decision. Server-gated; the API
// scopes the read to this partner (404 if not theirs). Decisions are Server Actions hitting the real endpoints:
// review → under_review, approve (amount + cooling-off window), reject (note), disburse (Idempotency-Key, Law 3).
// The API/state-machine is the authority — it rejects illegal transitions and re-enforces partner RBAC; this UI
// only offers the actions valid for the current status. Money is bigint-minor: the approved-amount field takes
// whole rupees and converts via BigInt (no float, Law 2).
import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requirePartner } from '../../../lib/partner-auth';
import { partnerClient } from '../../../lib/api-client';
import { formatMoneyMinor, formatDate } from '@krishi-verse/i18n';
import { SdkError } from '@krishi-verse/sdk-js';

export const dynamic = 'force-dynamic';

interface AppDetail {
  id: string; applicantUserId: string; productId: string; partnerId: string;
  amountRequestedMinor: string; amountApprovedMinor: string | null; purposeText: string | null;
  status: string; nwrId: string | null; decisionAt: string | null; decisionNote: string | null;
  coolingOffUntil: string | null; createdAt?: string;
}

async function review(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  try { await partnerClient().request('POST', `fintech/loan-applications/${id}/review`); }
  catch (e) { redirect(`/loan-queue/${id}?error=${encodeURIComponent(e instanceof SdkError ? e.code : 'ACTION_FAILED')}`); }
  revalidatePath(`/loan-queue/${id}`); redirect(`/loan-queue/${id}`);
}
async function approve(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  const rupees = String(formData.get('rupees') ?? '').trim();
  const coolingOffHours = Number(formData.get('coolingOffHours') ?? 24);
  if (!/^\d{1,13}$/.test(rupees)) redirect(`/loan-queue/${id}?error=BAD_AMOUNT`);
  const amountApprovedMinor = (BigInt(rupees) * 100n).toString();   // ₹ → paise, no float
  try { await partnerClient().request('POST', `fintech/loan-applications/${id}/approve`, { body: { amountApprovedMinor, coolingOffHours }, idempotencyKey: randomUUID() }); }
  catch (e) { redirect(`/loan-queue/${id}?error=${encodeURIComponent(e instanceof SdkError ? e.code : 'ACTION_FAILED')}`); }
  revalidatePath(`/loan-queue/${id}`); redirect(`/loan-queue/${id}`);
}
async function reject(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  const note = String(formData.get('note') ?? '').trim() || undefined;
  try { await partnerClient().request('POST', `fintech/loan-applications/${id}/reject`, { body: { note } }); }
  catch (e) { redirect(`/loan-queue/${id}?error=${encodeURIComponent(e instanceof SdkError ? e.code : 'ACTION_FAILED')}`); }
  revalidatePath(`/loan-queue/${id}`); redirect(`/loan-queue/${id}`);
}
async function disburse(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  try { await partnerClient().request('POST', `fintech/loan-applications/${id}/disburse`, { idempotencyKey: randomUUID() }); }
  catch (e) { redirect(`/loan-queue/${id}?error=${encodeURIComponent(e instanceof SdkError ? e.code : 'ACTION_FAILED')}`); }
  revalidatePath(`/loan-queue/${id}`); redirect(`/loan-queue/${id}`);
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return <div style={{ marginBottom: 8 }}><span style={{ color: 'var(--kv-neutral-600)', display: 'inline-block', minWidth: 180 }}>{label}</span><strong>{value}</strong></div>;
}

export default async function LoanApplicationPage({ params, searchParams }: { params: { id: string }; searchParams: { error?: string } }) {
  requirePartner();

  let a: AppDetail | undefined;
  let notice: string | undefined;
  try {
    const res = await partnerClient().request<AppDetail>('GET', `fintech/loan-applications/${params.id}`);
    a = res.data;
  } catch (e) {
    if (e instanceof SdkError && e.status === 404) notFound();
    notice = 'This application is temporarily unavailable.';
  }

  if (!a) {
    return <section><p style={{ marginBottom: 16 }}><Link href="/loan-queue">← Loan queue</Link></p><p className="kv-error">{notice}</p></section>;
  }

  const canReview = a.status === 'submitted';
  const canDecide = a.status === 'under_review';
  const canDisburse = a.status === 'approved';

  return (
    <section>
      <p style={{ marginBottom: 16 }}><Link href="/loan-queue">← Loan queue</Link></p>
      <h1>Application {a.id.slice(0, 8)}…</h1>
      {searchParams.error && <p className="kv-error">Action could not be completed ({searchParams.error}).</p>}

      <div className="kv-card" style={{ marginTop: 16 }}>
        <Field label="Status" value={a.status} />
        <Field label="Requested" value={formatMoneyMinor(a.amountRequestedMinor, 'INR', 'en')} />
        <Field label="Approved" value={a.amountApprovedMinor ? formatMoneyMinor(a.amountApprovedMinor, 'INR', 'en') : '—'} />
        <Field label="Purpose" value={a.purposeText ?? '—'} />
        <Field label="Collateral (NWR)" value={a.nwrId ?? '—'} />
        <Field label="Applied" value={a.createdAt ? formatDate(a.createdAt, 'en') : '—'} />
        {a.decisionAt && <Field label="Decided" value={formatDate(a.decisionAt, 'en')} />}
        {a.coolingOffUntil && <Field label="Cooling-off until" value={formatDate(a.coolingOffUntil, 'en')} />}
        {a.decisionNote && <Field label="Decision note" value={a.decisionNote} />}
      </div>

      {canReview && (
        <form action={review} style={{ marginTop: 24 }}>
          <input type="hidden" name="id" value={a.id} />
          <button className="kv-btn" type="submit">Begin review</button>
        </form>
      )}

      {canDecide && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24 }}>
          <form action={approve} className="kv-card">
            <h2>Approve</h2>
            <input type="hidden" name="id" value={a.id} />
            <label>Approved amount (₹, whole rupees)<br /><input className="kv-input" name="rupees" inputMode="numeric" required /></label>
            <label style={{ display: 'block', marginTop: 8 }}>Cooling-off window (hours)<br /><input className="kv-input" name="coolingOffHours" type="number" min={0} max={720} defaultValue={24} /></label>
            <p><button className="kv-btn" type="submit">Approve application</button></p>
          </form>
          <form action={reject} className="kv-card">
            <h2>Reject</h2>
            <input type="hidden" name="id" value={a.id} />
            <label>Reason (optional)<br /><textarea className="kv-input" name="note" rows={3} maxLength={500} /></label>
            <p><button className="kv-btn" type="submit" style={{ background: 'var(--kv-danger)' }}>Reject application</button></p>
          </form>
        </div>
      )}

      {canDisburse && (
        <form action={disburse} style={{ marginTop: 24 }}>
          <input type="hidden" name="id" value={a.id} />
          <button className="kv-btn" type="submit">Disburse approved amount</button>
          <p style={{ color: 'var(--kv-neutral-600)', fontSize: 13 }}>Disbursal moves funds and is idempotent; allowed only after the cooling-off window per platform rules.</p>
        </form>
      )}
    </section>
  );
}
