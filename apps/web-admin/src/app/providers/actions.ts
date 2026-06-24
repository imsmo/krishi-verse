'use server';
// apps/web-admin/src/app/providers/actions.ts · god-mode integration-provider mutation. The ONLY consequential
// write in this surface and the ONLY place the admin bearer writes for the providers path: enable/disable a
// provider PLATFORM-WIDE (Law 12 — pull a failing payment/comm/KYC provider out of rotation). admin-api re-
// authorises SERVER-SIDE (providers.manage + FIDO2 hardware-key + step-up) and records an audit row, so the
// operator's mandatory `reason` goes in the body. No secret material is ever touched. admin-api exposes no
// Idempotency-Key here, so none is passed; mutations never auto-retry. 'use server' files export ONLY async fns.
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '../../lib/admin-auth';
import { adminPatch, AdminApiError } from '../../lib/admin-client';
import { buildToggle } from '../../features/providers/provider';

function errorKey(e: unknown): string {
  if (e instanceof AdminApiError) {
    if (e.status === 403) return 'elevation';
    if (e.status === 409) return 'conflict';   // PROVIDER_ALREADY_IN_STATE (no-op)
    if (e.status === 404) return 'notFound';
  }
  return 'generic';
}
const enc = encodeURIComponent;

export async function toggleProviderAction(formData: FormData): Promise<void> {
  requireAdmin();
  const code = String(formData.get('code') ?? '').trim();
  if (!code) redirect('/providers');
  const built = buildToggle({ action: String(formData.get('action') ?? ''), reason: String(formData.get('reason') ?? '') });
  if (!built.ok) redirect(`/providers/${enc(code)}?error=${built.error}`);
  try { await adminPatch(`providers/${enc(code)}`, { body: built.value }); }
  catch (e) { redirect(`/providers/${enc(code)}?error=${errorKey(e)}`); }
  revalidatePath(`/providers/${code}`);
  revalidatePath('/providers');
  revalidatePath('/providers/health');
  redirect(`/providers/${enc(code)}?ok=${built.value.action}`);
}
