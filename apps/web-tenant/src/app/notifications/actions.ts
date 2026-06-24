'use server';
// apps/web-tenant/src/app/notifications/actions.ts · mark a notification read. AUTHENTICATED (requireSession).
// The inbox is the caller's OWN (server enforces ownership — a non-owner read/write is 404, no IDOR). mark-read is
// idempotent server-side, so it exposes no Idempotency-Key; we just revalidate the inbox so the read state shows.
import { revalidatePath } from 'next/cache';
import { tenantClient } from '../../lib/api-client';
import { requireSession } from '../../lib/session';

export async function markNotificationReadAction(formData: FormData): Promise<void> {
  await requireSession('/notifications');
  const id = String(formData.get('id') ?? '').trim();
  if (id) {
    try { await tenantClient().notifications.markRead(id); } catch { /* already read / transient → re-read reflects truth */ }
  }
  revalidatePath('/notifications');
}
