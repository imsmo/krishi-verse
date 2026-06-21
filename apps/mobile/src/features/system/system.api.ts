// apps/mobile/src/features/system/system.api.ts · data layer for the system/settings/search vertical (P-23). Keeps
// screens thin (guide §3). Global search FANS OUT over existing reads (public listings catalogue + the caller's own
// orders) and merges client-side — there's no dedicated search endpoint yet (flagged). DPDP export/deletion +
// phone-change hit ASSUMED endpoints (not live) and DEGRADE to a single-shape result so the screen shows an honest
// "submitted / unavailable" message — the app NEVER fabricates an export or deletes the account locally (Law 11).
// Feedback opens a real support ticket (P-22). Reads degrade-never-die; writes are idempotent (Law 3).
import type { ListingCard, OrderListItem } from '@krishi-verse/sdk-js';
import { apiClient } from '../../core/api/client';
import { newId } from '../../core/util/ids';
import { mergeSearchResults, normalizeQuery, type SearchHit } from './system';

/** Global search: query the public listings catalogue + the caller's own orders (both roles), merge + filter. */
export async function globalSearch(query: string): Promise<SearchHit[]> {
  const q = normalizeQuery(query);
  if (!q) return [];
  const [listings, buying, selling] = await Promise.all([
    apiClient().listings.browse({ q, limit: 20 }).then((p) => p.items).catch((): ListingCard[] => []),
    apiClient().orders.list({ role: 'buyer', limit: 20 }).then((p) => p.items).catch((): OrderListItem[] => []),
    apiClient().orders.list({ role: 'seller', limit: 20 }).then((p) => p.items).catch((): OrderListItem[] => []),
  ]);
  return mergeSearchResults(listings, [...buying, ...selling], q);
}

export interface PrivacyActionResult { ok: boolean; status?: string; reason?: 'unavailable' }
/** Request a DPDP data export. Degrades to { ok:false, reason:'unavailable' } if the endpoint isn't live yet. */
export async function requestDataExport(): Promise<PrivacyActionResult> {
  try { const r = await apiClient().privacy.requestDataExport(newId()); return { ok: true, status: r.status }; }
  catch { return { ok: false, reason: 'unavailable' }; }
}
/** Request account deletion (DPDP erasure). Degrades honestly; the server runs retention/anti-fraud holds. */
export async function requestAccountDeletion(reason?: string): Promise<PrivacyActionResult> {
  try { const r = await apiClient().privacy.requestAccountDeletion({ reason }, newId()); return { ok: true, status: r.status }; }
  catch { return { ok: false, reason: 'unavailable' }; }
}

export interface PhoneChangeResult { ok: boolean; reason?: 'unavailable' }
/** Start a phone-number change (server sends an OTP to the new number). Degrades honestly. */
export async function startPhoneChange(newPhone: string): Promise<PhoneChangeResult> {
  try { await apiClient().privacy.startPhoneChange(newPhone, newId()); return { ok: true }; }
  catch { return { ok: false, reason: 'unavailable' }; }
}
export async function confirmPhoneChange(newPhone: string, code: string): Promise<PhoneChangeResult> {
  try { await apiClient().privacy.confirmPhoneChange(newPhone, code); return { ok: true }; }
  catch { return { ok: false, reason: 'unavailable' }; }
}

/** Send feedback by opening a real support ticket (P-22 support module). Throws on a real error. */
export async function submitFeedback(text: string): Promise<{ id: string }> {
  const t = apiClient();
  const ticket = await t.support.open({ subject: text.slice(0, 250), severity: 'P3', channel: 'app' }, newId());
  return { id: ticket.id };
}
