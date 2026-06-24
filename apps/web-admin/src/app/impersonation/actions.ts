'use server';
// apps/web-admin/src/app/impersonation/actions.ts · god-mode act-as mutations — the highest-sensitivity writes in
// the platform and the ONLY place the admin bearer writes for the impersonation path. admin-api re-authorises
// SERVER-SIDE (impersonation.grant + FIDO2 hardware-key + step-up) and audits every action, so the operator's
// mandatory ≥8-char justification goes in the body. SECURITY: POST /grants returns the minted act-as token ONCE;
// this Server Action receives it SERVER-SIDE and DELIBERATELY DISCARDS it — the token is never returned to the
// browser, never serialised into props/HTML, never logged. We surface only the grant id + expiry. No money path.
// No Idempotency-Key (admin-api exposes none); mutations never auto-retry. 'use server' files export ONLY async fns.
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '../../lib/admin-auth';
import { adminPost, AdminApiError } from '../../lib/admin-client';
import { buildStartGrant, buildReason } from '../../features/impersonation/grant';

function errorKey(e: unknown): string {
  if (e instanceof AdminApiError) {
    switch (e.code) {
      case 'IMPERSONATION_DISABLED': return 'disabled';
      case 'IMPERSONATION_TARGET_PRIVILEGED': return 'privileged';
      case 'IMPERSONATION_TARGET_NOT_FOUND': return 'targetNotFound';
      case 'IMPERSONATION_ACTIVE_GRANT_EXISTS': return 'activeExists';
      case 'IMPERSONATION_SELF': return 'self';
      case 'IMPERSONATION_TTL_INVALID': return 'ttlSec';
      case 'IMPERSONATION_SCOPE_INVALID': return 'scope';
    }
    if (e.status === 403) return 'elevation';
    if (e.status === 404) return 'notFound';
    if (e.status === 409) return 'conflict';
  }
  return 'generic';
}
const enc = encodeURIComponent;

export async function startGrantAction(formData: FormData): Promise<void> {
  requireAdmin();
  const built = buildStartGrant({
    targetTenantId: String(formData.get('targetTenantId') ?? ''), targetUserId: String(formData.get('targetUserId') ?? ''),
    reason: String(formData.get('reason') ?? ''), ttlSec: String(formData.get('ttlSec') ?? ''), scope: String(formData.get('scope') ?? 'read_only'),
  });
  if (!built.ok) redirect(`/impersonation?error=${built.error}`);
  let grantId: string | undefined;
  try {
    // The response carries { grant, token, expiresAt }. We read ONLY grant.id — the token is a secret and is
    // intentionally left untouched here (never returned to the client).
    const res = await adminPost<{ grant: { id: string }; token: string; expiresAt: string }>('impersonation/grants', { body: built.value });
    grantId = res.data?.grant?.id;
  } catch (e) { redirect(`/impersonation?error=${errorKey(e)}`); }
  revalidatePath('/impersonation');
  redirect(grantId ? `/impersonation/grants/${enc(grantId)}?ok=minted` : '/impersonation?ok=minted');
}

export async function endGrantAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/impersonation');
  const built = buildReason({ reason: String(formData.get('reason') ?? '') });
  if (!built.ok) redirect(`/impersonation/grants/${enc(id)}?error=reason`);
  try { await adminPost(`impersonation/grants/${enc(id)}/end`, { body: built.value }); }
  catch (e) { redirect(`/impersonation/grants/${enc(id)}?error=${errorKey(e)}`); }
  revalidatePath(`/impersonation/grants/${id}`);
  revalidatePath('/impersonation');
  redirect(`/impersonation/grants/${enc(id)}?ok=ended`);
}

export async function revokeGrantAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/impersonation');
  const built = buildReason({ reason: String(formData.get('reason') ?? '') });
  if (!built.ok) redirect(`/impersonation/grants/${enc(id)}?error=reason`);
  try { await adminPost(`impersonation/grants/${enc(id)}/revoke`, { body: built.value }); }
  catch (e) { redirect(`/impersonation/grants/${enc(id)}?error=${errorKey(e)}`); }
  revalidatePath(`/impersonation/grants/${id}`);
  revalidatePath('/impersonation');
  redirect(`/impersonation/grants/${enc(id)}?ok=revoked`);
}
