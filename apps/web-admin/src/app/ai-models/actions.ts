'use server';
// apps/web-admin/src/app/ai-models/actions.ts · god-mode AI-MODEL mutations — the ONLY place the admin bearer
// writes for the ai/models path. Promoting a model moves it up/down the serving ladder ACROSS every tenant, and
// tuning its confidence threshold changes which inferences go to human review platform-wide — both are
// consequential, so admin-api re-authorises SERVER-SIDE (ai.model.manage + FIDO2 hardware-key + step-up) and
// audits every change with the operator's mandatory `reason`. Lifecycle moves obey the model state machine
// (shadow→canary→production→retired). No Idempotency-Key (admin-api exposes none); no auto-retry. 'use server'
// files export ONLY async functions.
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '../../lib/admin-auth';
import { adminPost, adminPatch, AdminApiError } from '../../lib/admin-client';
import { buildPromote, buildTuneThreshold, ModelActionError, isModelStatus, type ModelStatus } from '../../features/ai-models/model';

function apiErrorKey(e: unknown): string {
  if (e instanceof AdminApiError) {
    if (e.status === 403) return 'elevation';
    if (e.status === 409) return 'conflict';   // illegal transition / already in state
    if (e.status === 422) return 'invalid';     // bad input / illegal transition
    if (e.status === 404) return 'notFound';
  }
  return 'generic';
}
/** Pure-builder validation errors carry a stable i18n field token (e.g. threshold / illegal). */
function inputErrorKey(e: unknown, fallback = 'invalid'): string {
  return e instanceof ModelActionError ? e.fieldKey : fallback;
}
const enc = encodeURIComponent;
const str = (fd: FormData, k: string) => String(fd.get(k) ?? '');

export async function promoteModelAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = str(formData, 'id').trim();
  const fromRaw = str(formData, 'from').trim();
  if (!id || !isModelStatus(fromRaw)) redirect('/ai-models');
  let body;
  try { body = buildPromote(fromRaw as ModelStatus, str(formData, 'to'), str(formData, 'reason')); }
  catch (e) { redirect(`/ai-models/${enc(id)}?error=${inputErrorKey(e, 'illegal')}`); }
  try { await adminPost(`ai/models/${enc(id)}/promote`, { body }); }
  catch (e) { redirect(`/ai-models/${enc(id)}?error=${apiErrorKey(e)}`); }
  revalidatePath(`/ai-models/${id}`);
  redirect(`/ai-models/${enc(id)}?ok=promoted`);
}

export async function tuneThresholdAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = str(formData, 'id').trim();
  if (!id) redirect('/ai-models');
  let body;
  try { body = buildTuneThreshold(str(formData, 'confidenceThreshold'), str(formData, 'reason')); }
  catch (e) { redirect(`/ai-models/${enc(id)}?error=${inputErrorKey(e)}`); }
  try { await adminPatch(`ai/models/${enc(id)}/threshold`, { body }); }
  catch (e) { redirect(`/ai-models/${enc(id)}?error=${apiErrorKey(e)}`); }
  revalidatePath(`/ai-models/${id}`);
  redirect(`/ai-models/${enc(id)}?ok=${body.confidenceThreshold === null ? 'thresholdCleared' : 'threshold'}`);
}
