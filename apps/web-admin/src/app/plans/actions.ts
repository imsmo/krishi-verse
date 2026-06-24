'use server';
// apps/web-admin/src/app/plans/actions.ts · god-mode plan-catalogue mutations. The ONLY place the admin bearer
// writes for the plans path. Each is re-authorised SERVER-SIDE by admin-api (owner perm + FIDO2 hardware-key +
// step-up — plan/price changes hit revenue + every tenant's entitlements, Law 11) and carries the operator's
// mandatory audit reason. Plans are catalogue config — no ledger posting; money fields are minor-unit STRINGS
// (Law 2, never floated). admin-api exposes no Idempotency-Key here, so none is passed; mutations never auto-retry.
// 'use server' modules export ONLY async functions — validation lives in features/plans/plan.ts.
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '../../lib/admin-auth';
import { adminPost, adminPatch, adminPut, adminDelete, AdminApiError } from '../../lib/admin-client';
import { buildCreatePlan, buildPricing, buildVersion, buildSetLimit, validReason, validFeatureCode } from '../../features/plans/plan';

function errorKey(e: unknown): string {
  if (e instanceof AdminApiError) {
    if (e.status === 403) return 'elevation';
    if (e.status === 409) return 'conflict';
    if (e.status === 404) return 'notFound';
  }
  return 'generic';
}
const enc = encodeURIComponent;

export async function createPlanAction(formData: FormData): Promise<void> {
  requireAdmin();
  const built = buildCreatePlan({
    code: String(formData.get('code') ?? ''), defaultName: String(formData.get('defaultName') ?? ''),
    countryCode: String(formData.get('countryCode') ?? ''), currencyCode: String(formData.get('currencyCode') ?? ''),
    monthlyPriceMinor: String(formData.get('monthlyPriceMinor') ?? ''), annualPriceMinor: String(formData.get('annualPriceMinor') ?? ''),
    setupFeeMinor: String(formData.get('setupFeeMinor') ?? ''), isPublic: String(formData.get('isPublic') ?? 'true'),
    reason: String(formData.get('reason') ?? ''),
  });
  if (!built.ok) redirect(`/plans?error=${built.error}`);
  let id: string | undefined;
  try { id = (await adminPost<{ id: string }>('plans', { body: built.value })).data?.id; }
  catch (e) { redirect(`/plans?error=${errorKey(e)}`); }
  revalidatePath('/plans');
  redirect(id ? `/plans/${enc(id)}?ok=created` : '/plans?ok=created');
}

export async function lifecycleAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  const action = String(formData.get('action') ?? '');
  const reason = String(formData.get('reason') ?? '');
  if (!id) redirect('/plans');
  if (!['publish', 'archive', 'reactivate'].includes(action)) redirect(`/plans/${enc(id)}?error=generic`);
  if (!validReason(reason)) redirect(`/plans/${enc(id)}?error=reason`);
  try { await adminPatch(`plans/${enc(id)}`, { body: { action, reason: reason.trim() } }); }
  catch (e) { redirect(`/plans/${enc(id)}?error=${errorKey(e)}`); }
  revalidatePath(`/plans/${id}`);
  redirect(`/plans/${enc(id)}?ok=${action}`);
}

export async function setPricingAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/plans');
  const built = buildPricing({
    monthlyPriceMinor: String(formData.get('monthlyPriceMinor') ?? ''), annualPriceMinor: String(formData.get('annualPriceMinor') ?? ''),
    setupFeeMinor: String(formData.get('setupFeeMinor') ?? ''), reason: String(formData.get('reason') ?? ''),
  });
  if (!built.ok) redirect(`/plans/${enc(id)}?error=${built.error}`);
  try { await adminPatch(`plans/${enc(id)}/pricing`, { body: built.value }); }
  catch (e) { redirect(`/plans/${enc(id)}?error=${errorKey(e)}`); }
  revalidatePath(`/plans/${id}`);
  redirect(`/plans/${enc(id)}?ok=pricing`);
}

export async function versionPlanAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/plans');
  const built = buildVersion({
    monthlyPriceMinor: String(formData.get('monthlyPriceMinor') ?? ''), annualPriceMinor: String(formData.get('annualPriceMinor') ?? ''),
    setupFeeMinor: String(formData.get('setupFeeMinor') ?? ''), isPublic: String(formData.get('isPublic') ?? ''),
    reason: String(formData.get('reason') ?? ''),
  });
  if (!built.ok) redirect(`/plans/${enc(id)}?error=${built.error}`);
  try { await adminPost(`plans/${enc(id)}/version`, { body: built.value }); }
  catch (e) { redirect(`/plans/${enc(id)}?error=${errorKey(e)}`); }
  revalidatePath(`/plans/${id}`);
  redirect(`/plans/${enc(id)}?ok=versioned`);
}

export async function setFeatureAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  const code = String(formData.get('code') ?? '').trim();
  const reason = String(formData.get('reason') ?? '');
  const isIncluded = String(formData.get('isIncluded') ?? 'true') !== 'false';
  if (!id) redirect('/plans');
  if (!validFeatureCode(code)) redirect(`/plans/${enc(id)}?error=featureCode`);
  if (!validReason(reason)) redirect(`/plans/${enc(id)}?error=reason`);
  try { await adminPut(`plans/${enc(id)}/features/${enc(code)}`, { body: { isIncluded, reason: reason.trim() } }); }
  catch (e) { redirect(`/plans/${enc(id)}?error=${errorKey(e)}`); }
  revalidatePath(`/plans/${id}`);
  redirect(`/plans/${enc(id)}?ok=feature`);
}

export async function removeFeatureAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  const code = String(formData.get('code') ?? '').trim();
  const reason = String(formData.get('reason') ?? '');
  if (!id) redirect('/plans');
  if (!validFeatureCode(code) || !validReason(reason)) redirect(`/plans/${enc(id)}?error=reason`);
  try { await adminDelete(`plans/${enc(id)}/features/${enc(code)}`, { body: { reason: reason.trim() } }); }
  catch (e) { redirect(`/plans/${enc(id)}?error=${errorKey(e)}`); }
  revalidatePath(`/plans/${id}`);
  redirect(`/plans/${enc(id)}?ok=featureRemoved`);
}

export async function setLimitAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  const code = String(formData.get('limitCode') ?? '').trim();
  if (!id) redirect('/plans');
  const built = buildSetLimit({ limitCode: code, limitValue: String(formData.get('limitValue') ?? ''), reason: String(formData.get('reason') ?? '') });
  if (!built.ok) redirect(`/plans/${enc(id)}?error=${built.error}`);
  try { await adminPut(`plans/${enc(id)}/limits/${enc(code)}`, { body: built.value }); }
  catch (e) { redirect(`/plans/${enc(id)}?error=${errorKey(e)}`); }
  revalidatePath(`/plans/${id}`);
  redirect(`/plans/${enc(id)}?ok=limit`);
}

export async function removeLimitAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  const code = String(formData.get('code') ?? '').trim();
  const reason = String(formData.get('reason') ?? '');
  if (!id) redirect('/plans');
  if (!validFeatureCode(code) || !validReason(reason)) redirect(`/plans/${enc(id)}?error=reason`);
  try { await adminDelete(`plans/${enc(id)}/limits/${enc(code)}`, { body: { reason: reason.trim() } }); }
  catch (e) { redirect(`/plans/${enc(id)}?error=${errorKey(e)}`); }
  revalidatePath(`/plans/${id}`);
  redirect(`/plans/${enc(id)}?ok=limitRemoved`);
}
