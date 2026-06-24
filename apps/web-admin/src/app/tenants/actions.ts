'use server';
// apps/web-admin/src/app/tenants/actions.ts · god-mode tenant lifecycle mutations. The ONLY place the admin bearer
// writes for the tenants path. Each is re-authorised SERVER-SIDE by admin-api (owner perm + FIDO2 hardware-key +
// step-up freshness — Law 11) and carries the operator's mandatory audit `reason` in the body (admin-api zod-
// validates it). admin-api exposes no Idempotency-Key on these endpoints, so none is passed; mutations never
// auto-retry. A 403 → re-auth prompt (?error=elevation), a 409 illegal transition → ?error=illegal, else generic.
// 'use server' modules export ONLY async functions — validation lives in features/tenants/tenant.ts.
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '../../lib/admin-auth';
import { adminPost, adminPatch, AdminApiError } from '../../lib/admin-client';
import { buildLimitOverride, validReason } from '../../features/tenants/tenant';

function errorKey(e: unknown): string {
  if (e instanceof AdminApiError) {
    if (e.status === 403) return 'elevation';
    if (e.status === 409) return 'illegal';
    if (e.status === 404) return 'notFound';
  }
  return 'generic';
}

async function lifecycle(action: 'approve' | 'suspend' | 'archive', formData: FormData): Promise<void> {
  requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  const reason = String(formData.get('reason') ?? '');
  if (!id) redirect('/tenants');
  if (!validReason(reason)) redirect(`/tenants/${encodeURIComponent(id)}?error=reason`);
  try { await adminPost(`tenants/${encodeURIComponent(id)}/${action}`, { body: { reason: reason.trim() } }); }
  catch (e) { redirect(`/tenants/${encodeURIComponent(id)}?error=${errorKey(e)}`); }
  revalidatePath(`/tenants/${id}`);
  redirect(`/tenants/${encodeURIComponent(id)}?ok=${action}`);
}

export async function approveTenantAction(formData: FormData): Promise<void> { return lifecycle('approve', formData); }
export async function suspendTenantAction(formData: FormData): Promise<void> { return lifecycle('suspend', formData); }
export async function archiveTenantAction(formData: FormData): Promise<void> { return lifecycle('archive', formData); }

export async function overrideLimitAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/tenants');
  const built = buildLimitOverride({
    limitCode: String(formData.get('limitCode') ?? ''),
    limitValue: String(formData.get('limitValue') ?? ''),
    reason: String(formData.get('reason') ?? ''),
    expiresAt: String(formData.get('expiresAt') ?? ''),
  });
  if (!built.ok) redirect(`/tenants/${encodeURIComponent(id)}?error=${built.error}`);
  try { await adminPatch(`tenants/${encodeURIComponent(id)}/limits`, { body: built.value }); }
  catch (e) { redirect(`/tenants/${encodeURIComponent(id)}?error=${errorKey(e)}`); }
  revalidatePath(`/tenants/${id}`);
  redirect(`/tenants/${encodeURIComponent(id)}?ok=limits`);
}
