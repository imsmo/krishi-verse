'use server';
// apps/web-admin/src/app/support/actions.ts · god-mode support-oversight mutation. The ONLY consequential write
// in this surface and the ONLY place the admin bearer writes for the support path: a platform operator ESCALATES
// a tenant's ticket (raise severity / move to 'escalated' / reassign to a platform lead) when the tenant's support
// is failing its SLA. admin-api re-authorises SERVER-SIDE (support.oversight.manage + FIDO2 hardware-key +
// step-up — a cross-tenant override, Law 11) and records an audit row, so the operator's mandatory `reason` goes
// in the body. Support is money-free. No Idempotency-Key (admin-api exposes none); mutations never auto-retry.
// 'use server' files export ONLY async functions — validation lives in features/support/ticket.ts.
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '../../lib/admin-auth';
import { adminPost, AdminApiError } from '../../lib/admin-client';
import { buildEscalate } from '../../features/support/ticket';

function errorKey(e: unknown): string {
  if (e instanceof AdminApiError) {
    if (e.status === 403) return 'elevation';
    if (e.status === 422) return 'invalid';     // SUPPORT_ESCALATION_INVALID (no-op / would-lower)
    if (e.status === 409) return 'illegal';     // illegal status transition
    if (e.status === 404) return 'notFound';
  }
  return 'generic';
}
const enc = encodeURIComponent;

export async function escalateTicketAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/support');
  const built = buildEscalate({
    severity: String(formData.get('severity') ?? ''),
    reassignToUserId: String(formData.get('reassignToUserId') ?? ''),
    reason: String(formData.get('reason') ?? ''),
  });
  if (!built.ok) redirect(`/support/tickets/${enc(id)}?error=${built.error}`);
  try { await adminPost(`support/tickets/${enc(id)}/escalate`, { body: built.value }); }
  catch (e) { redirect(`/support/tickets/${enc(id)}?error=${errorKey(e)}`); }
  revalidatePath(`/support/tickets/${id}`);
  revalidatePath('/support');
  revalidatePath('/support/sla-breaches');
  redirect(`/support/tickets/${enc(id)}?ok=escalated`);
}
