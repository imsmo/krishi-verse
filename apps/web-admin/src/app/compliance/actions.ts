'use server';
// apps/web-admin/src/app/compliance/actions.ts · god-mode DPDP/compliance mutations — the ONLY place the admin
// bearer writes for the compliance path. Each is re-authorised SERVER-SIDE by admin-api (compliance.manage +
// FIDO2 hardware-key + step-up) and records an audit row, so the operator's mandatory justification (resolution /
// reason / note) goes in the body. PII-MINIMAL: nothing here accepts raw subject data — breaches carry data
// CATEGORIES only. admin-api exposes no Idempotency-Key here, so none is passed; mutations never auto-retry.
// 'use server' files export ONLY async functions — validation lives in features/compliance/compliance.ts.
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '../../lib/admin-auth';
import { adminPost, adminPatch, AdminApiError } from '../../lib/admin-client';
import { buildDsrUpdate, buildExportDecision, buildRetention, buildOpenBreach, buildBreachUpdate } from '../../features/compliance/compliance';

function errorKey(e: unknown): string {
  if (e instanceof AdminApiError) {
    if (e.status === 403) return 'elevation';
    if (e.status === 409) return 'conflict';     // illegal transition / cooling-active / export-already-decided
    if (e.status === 422) return 'invalid';
    if (e.status === 404) return 'notFound';
  }
  return 'generic';
}
const enc = encodeURIComponent;

export async function updateDsrAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/compliance');
  const built = buildDsrUpdate({ action: String(formData.get('action') ?? ''), resolution: String(formData.get('resolution') ?? ''), exportMediaId: String(formData.get('exportMediaId') ?? '') });
  if (!built.ok) redirect(`/compliance/dsr/${enc(id)}?error=${built.error}`);
  try { await adminPatch(`compliance/dsr/${enc(id)}`, { body: built.value }); }
  catch (e) { redirect(`/compliance/dsr/${enc(id)}?error=${errorKey(e)}`); }
  revalidatePath(`/compliance/dsr/${id}`);
  revalidatePath('/compliance');
  redirect(`/compliance/dsr/${enc(id)}?ok=${built.value.action}`);
}

export async function decideExportAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/compliance/exports');
  const built = buildExportDecision({ decision: String(formData.get('decision') ?? ''), reason: String(formData.get('reason') ?? '') });
  if (!built.ok) redirect(`/compliance/exports?error=${built.error}`);
  try { await adminPost(`compliance/exports/${enc(id)}/decision`, { body: built.value }); }
  catch (e) { redirect(`/compliance/exports?error=${errorKey(e)}`); }
  revalidatePath('/compliance/exports');
  redirect(`/compliance/exports?ok=${built.value.decision}`);
}

export async function upsertRetentionAction(formData: FormData): Promise<void> {
  requireAdmin();
  const built = buildRetention({
    tableName: String(formData.get('tableName') ?? ''), activeMonths: String(formData.get('activeMonths') ?? ''),
    archiveMonths: String(formData.get('archiveMonths') ?? ''), legalBasis: String(formData.get('legalBasis') ?? ''),
    action: String(formData.get('action') ?? ''), isActive: String(formData.get('isActive') ?? 'true'),
    reason: String(formData.get('reason') ?? ''),
  });
  if (!built.ok) redirect(`/compliance/retention?error=${built.error}`);
  try { await adminPost('compliance/retention', { body: built.value }); }
  catch (e) { redirect(`/compliance/retention?error=${errorKey(e)}`); }
  revalidatePath('/compliance/retention');
  redirect('/compliance/retention?ok=saved');
}

export async function openBreachAction(formData: FormData): Promise<void> {
  requireAdmin();
  const built = buildOpenBreach({
    affectedTenantId: String(formData.get('affectedTenantId') ?? ''), severity: String(formData.get('severity') ?? 'high'),
    title: String(formData.get('title') ?? ''), description: String(formData.get('description') ?? ''),
    affectedData: String(formData.get('affectedData') ?? ''), affectedCount: String(formData.get('affectedCount') ?? ''),
    detectedAt: String(formData.get('detectedAt') ?? ''),
  });
  if (!built.ok) redirect(`/compliance/breaches?error=${built.error}`);
  let id: string | undefined;
  try { id = (await adminPost<{ id: string }>('compliance/breaches', { body: built.value })).data?.id; }
  catch (e) { redirect(`/compliance/breaches?error=${errorKey(e)}`); }
  revalidatePath('/compliance/breaches');
  redirect(id ? `/compliance/breaches/${enc(id)}?ok=opened` : '/compliance/breaches?ok=opened');
}

export async function updateBreachAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/compliance/breaches');
  const built = buildBreachUpdate({
    action: String(formData.get('action') ?? ''), note: String(formData.get('note') ?? ''),
    regulatorNotifiedAt: String(formData.get('regulatorNotifiedAt') ?? ''), principalsNotifiedAt: String(formData.get('principalsNotifiedAt') ?? ''),
  });
  if (!built.ok) redirect(`/compliance/breaches/${enc(id)}?error=${built.error}`);
  try { await adminPatch(`compliance/breaches/${enc(id)}`, { body: built.value }); }
  catch (e) { redirect(`/compliance/breaches/${enc(id)}?error=${errorKey(e)}`); }
  revalidatePath(`/compliance/breaches/${id}`);
  revalidatePath('/compliance/breaches');
  redirect(`/compliance/breaches/${enc(id)}?ok=${built.value.action}`);
}
