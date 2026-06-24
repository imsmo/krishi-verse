'use server';
// apps/web-admin/src/app/catalogue/actions.ts · god-mode master-taxonomy mutations — the ONLY place the admin
// bearer writes for the catalogue path. A master-taxonomy change ripples into every tenant's catalogue, so admin-
// api re-authorises SERVER-SIDE (catalogue.manage + FIDO2 hardware-key + step-up) and audits every change; the
// operator's mandatory reason goes in the body. No money path. admin-api exposes no Idempotency-Key here, so none
// is passed; mutations never auto-retry. 'use server' files export ONLY async functions.
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '../../lib/admin-auth';
import { adminPost, adminPatch, AdminApiError } from '../../lib/admin-client';
import { buildCreateType, buildUpdateType, buildCreateValue, buildUpdateValue, buildSetActive, buildCreateCategory, buildUpdateCategory, buildMove } from '../../features/catalogue/catalogue';

function errorKey(e: unknown): string {
  if (e instanceof AdminApiError) {
    if (e.status === 403) return 'elevation';
    if (e.status === 409) return 'conflict';   // code-exists / already-in-state / parent-inactive / has-children
    if (e.status === 422) return 'invalid';      // input / depth / cycle / subtree-too-large
    if (e.status === 404) return 'notFound';
  }
  return 'generic';
}
const enc = encodeURIComponent;
const str = (fd: FormData, k: string) => String(fd.get(k) ?? '');

/* ---- lookup types ---- */
export async function createTypeAction(formData: FormData): Promise<void> {
  requireAdmin();
  const built = buildCreateType({ code: str(formData, 'code'), defaultName: str(formData, 'defaultName'), isTenantExtendable: str(formData, 'isTenantExtendable'), reason: str(formData, 'reason') });
  if (!built.ok) redirect(`/catalogue?error=${built.error}`);
  try { await adminPost('catalogue/lookup-types', { body: built.value }); }
  catch (e) { redirect(`/catalogue?error=${errorKey(e)}`); }
  revalidatePath('/catalogue');
  redirect(`/catalogue/lookup-types/${enc(built.value.code)}?ok=created`);
}

export async function updateTypeAction(formData: FormData): Promise<void> {
  requireAdmin();
  const code = str(formData, 'code').trim();
  if (!code) redirect('/catalogue');
  const built = buildUpdateType({ defaultName: str(formData, 'defaultName'), reason: str(formData, 'reason') });
  if (!built.ok) redirect(`/catalogue/lookup-types/${enc(code)}?error=${built.error}`);
  try { await adminPatch(`catalogue/lookup-types/${enc(code)}`, { body: built.value }); }
  catch (e) { redirect(`/catalogue/lookup-types/${enc(code)}?error=${errorKey(e)}`); }
  revalidatePath(`/catalogue/lookup-types/${code}`);
  redirect(`/catalogue/lookup-types/${enc(code)}?ok=updated`);
}

/* ---- lookup values ---- */
export async function createValueAction(formData: FormData): Promise<void> {
  requireAdmin();
  const built = buildCreateValue({ typeCode: str(formData, 'typeCode'), code: str(formData, 'code'), defaultName: str(formData, 'defaultName'), meta: str(formData, 'meta'), sortOrder: str(formData, 'sortOrder'), reason: str(formData, 'reason') });
  const typeCode = str(formData, 'typeCode').trim();
  if (!built.ok) redirect(`/catalogue/lookup-types/${enc(typeCode)}?error=${built.error}`);
  let id: string | undefined;
  try { id = (await adminPost<{ id: string }>('catalogue/lookup-values', { body: built.value })).data?.id; }
  catch (e) { redirect(`/catalogue/lookup-types/${enc(typeCode)}?error=${errorKey(e)}`); }
  revalidatePath(`/catalogue/lookup-types/${typeCode}`);
  redirect(id ? `/catalogue/lookup-values/${enc(id)}?ok=created` : `/catalogue/lookup-types/${enc(typeCode)}?ok=created`);
}

export async function updateValueAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = str(formData, 'id').trim();
  if (!id) redirect('/catalogue');
  const built = buildUpdateValue({ defaultName: str(formData, 'defaultName'), meta: str(formData, 'meta'), sortOrder: str(formData, 'sortOrder'), reason: str(formData, 'reason') });
  if (!built.ok) redirect(`/catalogue/lookup-values/${enc(id)}?error=${built.error}`);
  try { await adminPatch(`catalogue/lookup-values/${enc(id)}`, { body: built.value }); }
  catch (e) { redirect(`/catalogue/lookup-values/${enc(id)}?error=${errorKey(e)}`); }
  revalidatePath(`/catalogue/lookup-values/${id}`);
  redirect(`/catalogue/lookup-values/${enc(id)}?ok=updated`);
}

export async function setValueActiveAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = str(formData, 'id').trim();
  if (!id) redirect('/catalogue');
  const built = buildSetActive({ isActive: str(formData, 'isActive'), reason: str(formData, 'reason') });
  if (!built.ok) redirect(`/catalogue/lookup-values/${enc(id)}?error=${built.error}`);
  try { await adminPost(`catalogue/lookup-values/${enc(id)}/active`, { body: built.value }); }
  catch (e) { redirect(`/catalogue/lookup-values/${enc(id)}?error=${errorKey(e)}`); }
  revalidatePath(`/catalogue/lookup-values/${id}`);
  redirect(`/catalogue/lookup-values/${enc(id)}?ok=${built.value.isActive ? 'activated' : 'deactivated'}`);
}

/* ---- categories ---- */
export async function createCategoryAction(formData: FormData): Promise<void> {
  requireAdmin();
  const built = buildCreateCategory({
    parentId: str(formData, 'parentId'), slug: str(formData, 'slug'), defaultName: str(formData, 'defaultName'),
    commerceKind: str(formData, 'commerceKind'), requiresLicense: str(formData, 'requiresLicense'), requiresCertificate: str(formData, 'requiresCertificate'),
    minAge: str(formData, 'minAge'), sortOrder: str(formData, 'sortOrder'), iconMediaId: str(formData, 'iconMediaId'), reason: str(formData, 'reason'),
  });
  const back = built.ok && built.value.parentId ? `/catalogue/categories/${enc(built.value.parentId)}` : '/catalogue/categories';
  if (!built.ok) redirect(`/catalogue/categories?error=${built.error}`);
  let id: string | undefined;
  try { id = (await adminPost<{ id: string }>('catalogue/categories', { body: built.value })).data?.id; }
  catch (e) { redirect(`${back}?error=${errorKey(e)}`); }
  revalidatePath('/catalogue/categories');
  redirect(id ? `/catalogue/categories/${enc(id)}?ok=created` : `${back}?ok=created`);
}

export async function updateCategoryAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = str(formData, 'id').trim();
  if (!id) redirect('/catalogue/categories');
  const built = buildUpdateCategory({
    defaultName: str(formData, 'defaultName'), commerceKind: str(formData, 'commerceKind'), requiresLicense: str(formData, 'requiresLicense'),
    requiresCertificate: str(formData, 'requiresCertificate'), minAge: str(formData, 'minAge'), sortOrder: str(formData, 'sortOrder'), iconMediaId: str(formData, 'iconMediaId'), reason: str(formData, 'reason'),
  });
  if (!built.ok) redirect(`/catalogue/categories/${enc(id)}?error=${built.error}`);
  try { await adminPatch(`catalogue/categories/${enc(id)}`, { body: built.value }); }
  catch (e) { redirect(`/catalogue/categories/${enc(id)}?error=${errorKey(e)}`); }
  revalidatePath(`/catalogue/categories/${id}`);
  redirect(`/catalogue/categories/${enc(id)}?ok=updated`);
}

export async function moveCategoryAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = str(formData, 'id').trim();
  if (!id) redirect('/catalogue/categories');
  const built = buildMove({ newParentId: str(formData, 'newParentId'), reason: str(formData, 'reason') });
  if (!built.ok) redirect(`/catalogue/categories/${enc(id)}?error=${built.error}`);
  try { await adminPost(`catalogue/categories/${enc(id)}/move`, { body: built.value }); }
  catch (e) { redirect(`/catalogue/categories/${enc(id)}?error=${errorKey(e)}`); }
  revalidatePath(`/catalogue/categories/${id}`);
  redirect(`/catalogue/categories/${enc(id)}?ok=moved`);
}

export async function setCategoryActiveAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = str(formData, 'id').trim();
  if (!id) redirect('/catalogue/categories');
  const built = buildSetActive({ isActive: str(formData, 'isActive'), reason: str(formData, 'reason') });
  if (!built.ok) redirect(`/catalogue/categories/${enc(id)}?error=${built.error}`);
  try { await adminPost(`catalogue/categories/${enc(id)}/active`, { body: built.value }); }
  catch (e) { redirect(`/catalogue/categories/${enc(id)}?error=${errorKey(e)}`); }
  revalidatePath(`/catalogue/categories/${id}`);
  redirect(`/catalogue/categories/${enc(id)}?ok=${built.value.isActive ? 'activated' : 'deactivated'}`);
}
