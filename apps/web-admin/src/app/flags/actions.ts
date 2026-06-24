'use server';
// apps/web-admin/src/app/flags/actions.ts · god-mode feature-flag mutations. The ONLY place the admin bearer writes
// for the flags path. Each is re-authorised SERVER-SIDE by admin-api (owner perm + FIDO2 hardware-key + step-up —
// a global flag flip affects every tenant, Law 10/11) and carries the operator's mandatory audit `reason`. admin-
// api exposes no Idempotency-Key here, so none is passed; mutations never auto-retry. The PATCH body is the
// discriminated-union action the controller dispatches (enable/disable/set_rollout/set_targeting/kill/unlock).
// 'use server' modules export ONLY async functions — validation lives in features/flags/flag.ts.
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '../../lib/admin-auth';
import { adminPost, adminPatch, AdminApiError } from '../../lib/admin-client';
import { buildCreateFlag, parseRolloutPct, buildTargeting, validFlagReason } from '../../features/flags/flag';

function errorKey(e: unknown): string {
  if (e instanceof AdminApiError) {
    if (e.status === 403) return 'elevation';
    if (e.status === 409) return 'locked';
    if (e.status === 404) return 'notFound';
  }
  return 'generic';
}

export async function createFlagAction(formData: FormData): Promise<void> {
  requireAdmin();
  const built = buildCreateFlag({
    key: String(formData.get('key') ?? ''),
    description: String(formData.get('description') ?? ''),
    rolloutPct: String(formData.get('rolloutPct') ?? '0'),
    reason: String(formData.get('reason') ?? ''),
    tenantIds: String(formData.get('tenantIds') ?? ''),
    plans: String(formData.get('plans') ?? ''),
    countries: String(formData.get('countries') ?? ''),
  });
  if (!built.ok) redirect(`/flags?error=${built.error}`);
  try { await adminPost('flags', { body: built.value }); }
  catch (e) { redirect(`/flags?error=${errorKey(e)}`); }
  revalidatePath('/flags');
  redirect(`/flags/${encodeURIComponent(built.value.key)}?ok=created`);
}

/** Simple action (enable / disable / kill / unlock) — reason only. */
async function simple(action: 'enable' | 'disable' | 'kill' | 'unlock', formData: FormData): Promise<void> {
  requireAdmin();
  const key = String(formData.get('key') ?? '').trim();
  const reason = String(formData.get('reason') ?? '');
  if (!key) redirect('/flags');
  if (!validFlagReason(reason)) redirect(`/flags/${encodeURIComponent(key)}?error=reason`);
  try { await adminPatch(`flags/${encodeURIComponent(key)}`, { body: { action, reason: reason.trim() } }); }
  catch (e) { redirect(`/flags/${encodeURIComponent(key)}?error=${errorKey(e)}`); }
  revalidatePath(`/flags/${key}`);
  redirect(`/flags/${encodeURIComponent(key)}?ok=${action}`);
}
export async function enableFlagAction(formData: FormData): Promise<void> { return simple('enable', formData); }
export async function disableFlagAction(formData: FormData): Promise<void> { return simple('disable', formData); }
export async function killFlagAction(formData: FormData): Promise<void> { return simple('kill', formData); }
export async function unlockFlagAction(formData: FormData): Promise<void> { return simple('unlock', formData); }

export async function setRolloutAction(formData: FormData): Promise<void> {
  requireAdmin();
  const key = String(formData.get('key') ?? '').trim();
  const reason = String(formData.get('reason') ?? '');
  if (!key) redirect('/flags');
  const pct = parseRolloutPct(String(formData.get('rolloutPct') ?? ''));
  if (!pct.ok) redirect(`/flags/${encodeURIComponent(key)}?error=rolloutPct`);
  if (!validFlagReason(reason)) redirect(`/flags/${encodeURIComponent(key)}?error=reason`);
  try { await adminPatch(`flags/${encodeURIComponent(key)}`, { body: { action: 'set_rollout', rolloutPct: pct.value, reason: reason.trim() } }); }
  catch (e) { redirect(`/flags/${encodeURIComponent(key)}?error=${errorKey(e)}`); }
  revalidatePath(`/flags/${key}`);
  redirect(`/flags/${encodeURIComponent(key)}?ok=rollout`);
}

export async function setTargetingAction(formData: FormData): Promise<void> {
  requireAdmin();
  const key = String(formData.get('key') ?? '').trim();
  const reason = String(formData.get('reason') ?? '');
  if (!key) redirect('/flags');
  const targ = buildTargeting({
    tenantIds: String(formData.get('tenantIds') ?? ''),
    plans: String(formData.get('plans') ?? ''),
    countries: String(formData.get('countries') ?? ''),
  });
  if (!targ.ok) redirect(`/flags/${encodeURIComponent(key)}?error=${targ.error}`);
  if (!validFlagReason(reason)) redirect(`/flags/${encodeURIComponent(key)}?error=reason`);
  try { await adminPatch(`flags/${encodeURIComponent(key)}`, { body: { action: 'set_targeting', ...targ.value, reason: reason.trim() } }); }
  catch (e) { redirect(`/flags/${encodeURIComponent(key)}?error=${errorKey(e)}`); }
  revalidatePath(`/flags/${key}`);
  redirect(`/flags/${encodeURIComponent(key)}?ok=targeting`);
}
