'use server';
// apps/web-admin/src/app/schemes-registry/actions.ts · god-mode government-scheme MASTER mutations — the ONLY
// place the admin bearer writes for the schemes-registry path. A master edit ripples into every tenant's scheme
// catalogue + applications, so admin-api re-authorises SERVER-SIDE (schemes.registry.manage + FIDO2 hardware-key +
// step-up) and audits every change; the operator's mandatory reason goes in the body. processing_fee_minor is a
// minor-unit digit STRING (Law 2, never floated). No Idempotency-Key (admin-api exposes none); no auto-retry.
// 'use server' files export ONLY async functions.
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '../../lib/admin-auth';
import { adminPost, adminPatch, AdminApiError } from '../../lib/admin-client';
import { buildCreateAuthority, buildUpdateAuthority, buildCreateScheme, buildUpdateMeta, buildUpdateRules, buildSetWindow, buildSetActive } from '../../features/schemes-registry/scheme';

function errorKey(e: unknown): string {
  if (e instanceof AdminApiError) {
    if (e.status === 403) return 'elevation';
    if (e.status === 409) return 'conflict';     // code exists / already in state
    if (e.status === 422) return 'invalid';        // input / category invalid
    if (e.status === 404) return 'notFound';
  }
  return 'generic';
}
const enc = encodeURIComponent;
const str = (fd: FormData, k: string) => String(fd.get(k) ?? '');

/* ---- authorities ---- */
export async function createAuthorityAction(formData: FormData): Promise<void> {
  requireAdmin();
  const built = buildCreateAuthority({ defaultName: str(formData, 'defaultName'), level: str(formData, 'level'), regionId: str(formData, 'regionId'), reason: str(formData, 'reason') });
  if (!built.ok) redirect(`/schemes-registry?error=${built.error}`);
  let id: string | undefined;
  try { id = (await adminPost<{ id: string }>('schemes-registry/authorities', { body: built.value })).data?.id; }
  catch (e) { redirect(`/schemes-registry?error=${errorKey(e)}`); }
  revalidatePath('/schemes-registry');
  redirect(id ? `/schemes-registry/authorities/${enc(id)}?ok=created` : '/schemes-registry?ok=created');
}

export async function updateAuthorityAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = str(formData, 'id').trim();
  if (!id) redirect('/schemes-registry');
  const built = buildUpdateAuthority({ defaultName: str(formData, 'defaultName'), level: str(formData, 'level'), regionId: str(formData, 'regionId'), reason: str(formData, 'reason') });
  if (!built.ok) redirect(`/schemes-registry/authorities/${enc(id)}?error=${built.error}`);
  try { await adminPatch(`schemes-registry/authorities/${enc(id)}`, { body: built.value }); }
  catch (e) { redirect(`/schemes-registry/authorities/${enc(id)}?error=${errorKey(e)}`); }
  revalidatePath(`/schemes-registry/authorities/${id}`);
  redirect(`/schemes-registry/authorities/${enc(id)}?ok=updated`);
}

/* ---- schemes ---- */
export async function createSchemeAction(formData: FormData): Promise<void> {
  requireAdmin();
  const built = buildCreateScheme({
    code: str(formData, 'code'), defaultName: str(formData, 'defaultName'), authorityId: str(formData, 'authorityId'), categoryId: str(formData, 'categoryId'),
    benefitSummary: str(formData, 'benefitSummary'), eligibilityRules: str(formData, 'eligibilityRules'),
    requiredDocTypeIds: str(formData, 'requiredDocTypeIds'), applicableRegionIds: str(formData, 'applicableRegionIds'),
    applicationWindow_opens: str(formData, 'opens'), applicationWindow_closes: str(formData, 'closes'), applicationWindow_season: str(formData, 'season'),
    processingFeeMinor: str(formData, 'processingFeeMinor'), sourceUrl: str(formData, 'sourceUrl'), reason: str(formData, 'reason'),
  });
  if (!built.ok) redirect(`/schemes-registry/schemes?error=${built.error}`);
  let id: string | undefined;
  try { id = (await adminPost<{ id: string }>('schemes-registry/schemes', { body: built.value })).data?.id; }
  catch (e) { redirect(`/schemes-registry/schemes?error=${errorKey(e)}`); }
  revalidatePath('/schemes-registry/schemes');
  redirect(id ? `/schemes-registry/schemes/${enc(id)}?ok=created` : '/schemes-registry/schemes?ok=created');
}

export async function updateMetaAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = str(formData, 'id').trim();
  if (!id) redirect('/schemes-registry/schemes');
  const built = buildUpdateMeta({ defaultName: str(formData, 'defaultName'), authorityId: str(formData, 'authorityId'), categoryId: str(formData, 'categoryId'), sourceUrl: str(formData, 'sourceUrl'), reason: str(formData, 'reason') });
  if (!built.ok) redirect(`/schemes-registry/schemes/${enc(id)}?error=${built.error}`);
  try { await adminPatch(`schemes-registry/schemes/${enc(id)}`, { body: built.value }); }
  catch (e) { redirect(`/schemes-registry/schemes/${enc(id)}?error=${errorKey(e)}`); }
  revalidatePath(`/schemes-registry/schemes/${id}`);
  redirect(`/schemes-registry/schemes/${enc(id)}?ok=meta`);
}

export async function updateRulesAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = str(formData, 'id').trim();
  if (!id) redirect('/schemes-registry/schemes');
  const built = buildUpdateRules({ benefitSummary: str(formData, 'benefitSummary'), eligibilityRules: str(formData, 'eligibilityRules'), requiredDocTypeIds: str(formData, 'requiredDocTypeIds'), applicableRegionIds: str(formData, 'applicableRegionIds'), processingFeeMinor: str(formData, 'processingFeeMinor'), reason: str(formData, 'reason') });
  if (!built.ok) redirect(`/schemes-registry/schemes/${enc(id)}?error=${built.error}`);
  try { await adminPost(`schemes-registry/schemes/${enc(id)}/rules`, { body: built.value }); }
  catch (e) { redirect(`/schemes-registry/schemes/${enc(id)}?error=${errorKey(e)}`); }
  revalidatePath(`/schemes-registry/schemes/${id}`);
  redirect(`/schemes-registry/schemes/${enc(id)}?ok=rules`);
}

export async function setWindowAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = str(formData, 'id').trim();
  if (!id) redirect('/schemes-registry/schemes');
  const built = buildSetWindow({ opens: str(formData, 'opens'), closes: str(formData, 'closes'), season: str(formData, 'season'), reason: str(formData, 'reason') });
  if (!built.ok) redirect(`/schemes-registry/schemes/${enc(id)}?error=${built.error}`);
  try { await adminPost(`schemes-registry/schemes/${enc(id)}/window`, { body: built.value }); }
  catch (e) { redirect(`/schemes-registry/schemes/${enc(id)}?error=${errorKey(e)}`); }
  revalidatePath(`/schemes-registry/schemes/${id}`);
  redirect(`/schemes-registry/schemes/${enc(id)}?ok=window`);
}

export async function setSchemeActiveAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = str(formData, 'id').trim();
  if (!id) redirect('/schemes-registry/schemes');
  const built = buildSetActive({ isActive: str(formData, 'isActive'), reason: str(formData, 'reason') });
  if (!built.ok) redirect(`/schemes-registry/schemes/${enc(id)}?error=${built.error}`);
  try { await adminPost(`schemes-registry/schemes/${enc(id)}/active`, { body: built.value }); }
  catch (e) { redirect(`/schemes-registry/schemes/${enc(id)}?error=${errorKey(e)}`); }
  revalidatePath(`/schemes-registry/schemes/${id}`);
  redirect(`/schemes-registry/schemes/${enc(id)}?ok=${built.value.isActive ? 'activated' : 'deactivated'}`);
}
