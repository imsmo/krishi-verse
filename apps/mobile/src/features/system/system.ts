// apps/mobile/src/features/system/system.ts · PURE cross-cutting logic for the system/settings/search vertical
// (P-23). No React/native (SDK/ui types are `import type` → erased) → unit-tested. Covers: global-search result
// merge + local ranking (ReDoS-safe), semver compare + forced-update decision, the permission rationale catalog,
// and DPDP delete-confirmation validation. The SERVER owns search authority, DPDP export/erasure, and the minimum
// supported version — these helpers only drive the UI.
import type { ListingCard, OrderListItem } from '@krishi-verse/sdk-js';

// --- global search ---
export type SearchHitKind = 'listing' | 'order';
export interface SearchHit { kind: SearchHitKind; id: string; title: string; subtitle?: string }

/** Normalize a search query: trim, collapse whitespace, lowercase, cap length (bounded; plain — no regex). */
export function normalizeQuery(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 80);
}
function contains(haystack: string, q: string): boolean { return haystack.toLowerCase().includes(q); }

/** Merge listings + the caller's orders into a unified, query-filtered hit list (listings first, then orders;
 * capped). Matching is a plain case-insensitive substring over the visible text (no regex on user input). */
export function mergeSearchResults(listings: ListingCard[], orders: OrderListItem[], query: string, cap = 50): SearchHit[] {
  const q = normalizeQuery(query);
  const lHits: SearchHit[] = (listings ?? [])
    .filter((l) => !q || contains(l.title ?? '', q))
    .map((l) => ({ kind: 'listing' as const, id: l.id, title: l.title, subtitle: l.unitCode }));
  const oHits: SearchHit[] = (orders ?? [])
    .filter((o) => !q || contains(o.orderNo ?? '', q) || contains(o.status ?? '', q) || contains(o.counterparty ?? '', q))
    .map((o) => ({ kind: 'order' as const, id: o.id, title: o.orderNo, subtitle: o.status }));
  return [...lHits, ...oHits].slice(0, cap);
}

// --- app version / forced update (semver) ---
/** Compare two dotted versions numerically. Returns -1 (a<b), 0 (equal), 1 (a>b). Non-numeric parts → 0. */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const pa = String(a ?? '').split('.').map((x) => parseInt(x, 10) || 0);
  const pb = String(b ?? '').split('.').map((x) => parseInt(x, 10) || 0);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) { const d = (pa[i] ?? 0) - (pb[i] ?? 0); if (d !== 0) return d < 0 ? -1 : 1; }
  return 0;
}
/** A forced update is required only when a minimum is configured AND the current version is below it. */
export function isUpdateRequired(current: string, min: string | null | undefined): boolean {
  if (!min) return false;
  return compareVersions(current, min) < 0;
}

// --- permission rationale catalog (just-in-time, store-compliant; §8) ---
export interface PermissionItem { key: string; icon: string }
export const PERMISSIONS: PermissionItem[] = [
  { key: 'camera', icon: '📷' },
  { key: 'photos', icon: '🖼️' },
  { key: 'location', icon: '📍' },
  { key: 'microphone', icon: '🎙️' },
  { key: 'notifications', icon: '🔔' },
];
export function permissionTitleKey(key: string): string { return `system.permissions.${key}.title`; }
export function permissionWhyKey(key: string): string { return `system.permissions.${key}.why`; }

// --- DPDP account-delete confirmation (typed phrase guard against accidental taps) ---
/** The user must type the confirmation word exactly (case-insensitive, trimmed) to enable deletion. The word is
 * the localized `expected` (e.g. "DELETE"/"हटाएँ") — compared verbatim, no regex. */
export function deleteConfirmationOk(input: string, expected: string): boolean {
  return (input ?? '').trim().toLowerCase() === (expected ?? '').trim().toLowerCase() && !!(expected ?? '').trim();
}
