'use server';
// apps/web-admin/src/app/recon/actions.ts · god-mode money-safety mutations. The ONLY place the admin bearer writes
// for the recon path. Each is re-authorised SERVER-SIDE by admin-api (owner perm + FIDO2 hardware-key + step-up —
// consequential money controls, Law 11) and carries the operator's mandatory audit reason/summary/note. admin-api
// exposes no Idempotency-Key here, so none is passed; mutations never auto-retry. recon NEVER posts the ledger —
// a freeze only flips wallet_accounts.is_frozen server-side. 'use server' modules export ONLY async functions —
// validation lives in features/recon/recon.ts.
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '../../lib/admin-auth';
import { adminPost, adminPatch, AdminApiError } from '../../lib/admin-client';
import { validReason, SEVERITIES, type Severity } from '../../features/recon/recon';

function errorKey(e: unknown): string {
  if (e instanceof AdminApiError) {
    if (e.status === 403) return 'elevation';
    if (e.status === 409) return 'illegal';
    if (e.status === 404) return 'notFound';
  }
  return 'generic';
}

export async function openInvestigationAction(formData: FormData): Promise<void> {
  requireAdmin();
  const runId = String(formData.get('runId') ?? '').trim();
  const summary = String(formData.get('summary') ?? '');
  const sevRaw = String(formData.get('severity') ?? 'high');
  const severity: Severity = (SEVERITIES as readonly string[]).includes(sevRaw) ? (sevRaw as Severity) : 'high';
  if (!runId) redirect('/recon/runs');
  if (!validReason(summary)) redirect(`/recon/runs/${encodeURIComponent(runId)}?error=summary`);
  let id: string | undefined;
  try {
    const res = await adminPost<{ id: string }>('recon/investigations', { body: { runId, severity, summary: summary.trim() } });
    id = res.data?.id;
  } catch (e) { redirect(`/recon/runs/${encodeURIComponent(runId)}?error=${errorKey(e)}`); }
  if (id) redirect(`/recon/investigations/${encodeURIComponent(id)}?ok=opened`);
  redirect('/recon/investigations?ok=opened');
}

export async function updateInvestigationAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  const action = String(formData.get('action') ?? '');
  const note = String(formData.get('note') ?? '');
  if (!id) redirect('/recon/investigations');
  if (!['start', 'resolve', 'false_positive'].includes(action)) redirect(`/recon/investigations/${encodeURIComponent(id)}?error=generic`);
  if (!validReason(note)) redirect(`/recon/investigations/${encodeURIComponent(id)}?error=note`);
  try { await adminPatch(`recon/investigations/${encodeURIComponent(id)}`, { body: { action, note: note.trim() } }); }
  catch (e) { redirect(`/recon/investigations/${encodeURIComponent(id)}?error=${errorKey(e)}`); }
  revalidatePath(`/recon/investigations/${id}`);
  redirect(`/recon/investigations/${encodeURIComponent(id)}?ok=${action}`);
}

export async function freezeAccountAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  const action = String(formData.get('action') ?? '');
  const reason = String(formData.get('reason') ?? '');
  if (!id) redirect('/recon');
  if (action !== 'freeze' && action !== 'unfreeze') redirect(`/recon/accounts/${encodeURIComponent(id)}?error=generic`);
  if (!validReason(reason)) redirect(`/recon/accounts/${encodeURIComponent(id)}?error=reason`);
  try { await adminPost(`recon/accounts/${encodeURIComponent(id)}/freeze`, { body: { action, reason: reason.trim() } }); }
  catch (e) { redirect(`/recon/accounts/${encodeURIComponent(id)}?error=${errorKey(e)}`); }
  revalidatePath(`/recon/accounts/${id}`);
  redirect(`/recon/accounts/${encodeURIComponent(id)}?ok=${action}`);
}
