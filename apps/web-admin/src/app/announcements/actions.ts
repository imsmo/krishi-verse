'use server';
// apps/web-admin/src/app/announcements/actions.ts · god-mode platform-announcement mutations — the ONLY place the
// admin bearer writes for the announcements path. A platform-wide notice reaches every tenant, so admin-api re-
// authorises SERVER-SIDE (announcements.manage + FIDO2 hardware-key + step-up) and audits every action; the
// operator's mandatory reason goes in the body. Text is plain (no HTML — validated in features/announcements).
// No money. admin-api exposes no Idempotency-Key here, so none is passed; mutations never auto-retry.
// 'use server' files export ONLY async functions.
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '../../lib/admin-auth';
import { adminPost, adminPatch, AdminApiError } from '../../lib/admin-client';
import { buildContent, buildSchedule, buildPublish, buildReason } from '../../features/announcements/announcement';

function errorKey(e: unknown): string {
  if (e instanceof AdminApiError) {
    if (e.status === 403) return 'elevation';
    if (e.status === 409) return 'conflict';      // illegal transition / immutable
    if (e.status === 422) return 'invalid';        // content / schedule invalid
    if (e.status === 404) return 'notFound';
  }
  return 'generic';
}
const enc = encodeURIComponent;

function readContent(formData: FormData) {
  return buildContent({
    title: String(formData.get('title') ?? ''), body: String(formData.get('body') ?? ''),
    severity: String(formData.get('severity') ?? 'info'), placement: String(formData.get('placement') ?? 'banner'),
    plans: String(formData.get('plans') ?? ''), countries: String(formData.get('countries') ?? ''),
    reason: String(formData.get('reason') ?? ''),
  });
}

export async function createAnnouncementAction(formData: FormData): Promise<void> {
  requireAdmin();
  const built = readContent(formData);
  if (!built.ok) redirect(`/announcements?error=${built.error}`);
  let id: string | undefined;
  try { id = (await adminPost<{ id: string }>('announcements', { body: built.value })).data?.id; }
  catch (e) { redirect(`/announcements?error=${errorKey(e)}`); }
  revalidatePath('/announcements');
  redirect(id ? `/announcements/${enc(id)}?ok=created` : '/announcements?ok=created');
}

export async function updateAnnouncementAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/announcements');
  const built = readContent(formData);
  if (!built.ok) redirect(`/announcements/${enc(id)}?error=${built.error}`);
  try { await adminPatch(`announcements/${enc(id)}`, { body: built.value }); }
  catch (e) { redirect(`/announcements/${enc(id)}?error=${errorKey(e)}`); }
  revalidatePath(`/announcements/${id}`);
  redirect(`/announcements/${enc(id)}?ok=updated`);
}

export async function scheduleAnnouncementAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/announcements');
  const built = buildSchedule({ startsAt: String(formData.get('startsAt') ?? ''), endsAt: String(formData.get('endsAt') ?? ''), reason: String(formData.get('reason') ?? '') });
  if (!built.ok) redirect(`/announcements/${enc(id)}?error=${built.error}`);
  try { await adminPost(`announcements/${enc(id)}/schedule`, { body: built.value }); }
  catch (e) { redirect(`/announcements/${enc(id)}?error=${errorKey(e)}`); }
  revalidatePath(`/announcements/${id}`);
  redirect(`/announcements/${enc(id)}?ok=scheduled`);
}

export async function publishAnnouncementAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/announcements');
  const built = buildPublish({ endsAt: String(formData.get('endsAt') ?? ''), reason: String(formData.get('reason') ?? '') });
  if (!built.ok) redirect(`/announcements/${enc(id)}?error=${built.error}`);
  try { await adminPost(`announcements/${enc(id)}/publish`, { body: built.value }); }
  catch (e) { redirect(`/announcements/${enc(id)}?error=${errorKey(e)}`); }
  revalidatePath(`/announcements/${id}`);
  revalidatePath('/announcements');
  redirect(`/announcements/${enc(id)}?ok=published`);
}

export async function expireAnnouncementAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/announcements');
  const built = buildReason({ reason: String(formData.get('reason') ?? '') });
  if (!built.ok) redirect(`/announcements/${enc(id)}?error=reason`);
  try { await adminPost(`announcements/${enc(id)}/expire`, { body: built.value }); }
  catch (e) { redirect(`/announcements/${enc(id)}?error=${errorKey(e)}`); }
  revalidatePath(`/announcements/${id}`);
  redirect(`/announcements/${enc(id)}?ok=expired`);
}

export async function archiveAnnouncementAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/announcements');
  const built = buildReason({ reason: String(formData.get('reason') ?? '') });
  if (!built.ok) redirect(`/announcements/${enc(id)}?error=reason`);
  try { await adminPost(`announcements/${enc(id)}/archive`, { body: built.value }); }
  catch (e) { redirect(`/announcements/${enc(id)}?error=${errorKey(e)}`); }
  revalidatePath(`/announcements/${id}`);
  redirect(`/announcements/${enc(id)}?ok=archived`);
}
