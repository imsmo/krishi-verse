// apps/mobile/src/features/buyer/saved.api.ts · the buyer's SAVED lists (listings / sellers / searches).
// FLAGGED BACKEND GAP: there is no server endpoint for saved-listings/saved-sellers/saved-searches yet, so rather
// than fake server sync we persist these ON-DEVICE (AsyncStorage, non-secret), scoped to the signed-in user via
// currentScope() so one account can't read another's saves. They survive restarts (DoD: "saves persist") and will
// sync to a server wishlist endpoint when it lands. Lists are deduped + capped via the pure saved-set helpers
// (bounded storage, guide §5). We store a small ListingCard snapshot so the saved screen renders offline. Money
// stays a bigint-minor string (Law 2). Degrade-never-die: a storage error yields an empty list, never a throw.
import type { ListingCard } from '@krishi-verse/sdk-js';
import { asyncStorageKv as kv } from '../../core/offline/kv';
import { currentScope } from '../../core/offline/scope';
import { newId } from '../../core/util/ids';
import { toggleId, dedupeBy, capList, upsertFront } from './saved-set';
import type { FilterForm } from './search-query';

const MAX = 200;
const key = (kind: string) => `buyer.saved.${kind}:${currentScope()}`;

export interface SavedSearch { id: string; label: string; form: FilterForm; savedAt: number }

async function load<T>(kind: string): Promise<T[]> {
  try { const raw = await kv.get(key(kind)); return raw ? (JSON.parse(raw) as T[]) : []; }
  catch { return []; }
}
async function save<T>(kind: string, list: T[]): Promise<void> {
  try { await kv.set(key(kind), JSON.stringify(list)); } catch { /* best-effort; degrade-never-die */ }
}

// --- saved listings (store snapshots) ---
export function getSavedListings(): Promise<ListingCard[]> { return load<ListingCard>('listings'); }
export async function toggleSavedListing(card: ListingCard): Promise<ListingCard[]> {
  const list = await getSavedListings();
  const exists = list.some((l) => l.id === card.id);
  const next = exists ? list.filter((l) => l.id !== card.id) : capList(dedupeBy([card, ...list], (l) => l.id), MAX);
  await save('listings', next);
  return next;
}

// --- saved sellers (ids only — we have no public profile yet) ---
export function getSavedSellers(): Promise<string[]> { return load<string>('sellers'); }
export async function toggleSavedSeller(sellerUserId: string): Promise<string[]> {
  const next = capList(toggleId(await getSavedSellers(), sellerUserId), MAX);
  await save('sellers', next);
  return next;
}

// --- saved searches ---
export function getSavedSearches(): Promise<SavedSearch[]> { return load<SavedSearch>('searches'); }
export async function addSavedSearch(label: string, form: FilterForm): Promise<SavedSearch[]> {
  const entry: SavedSearch = { id: newId(), label, form, savedAt: Date.now() };
  // dedupe by the serialized form so the same search isn't saved twice.
  const next = upsertFront(await getSavedSearches(), entry, (s) => JSON.stringify(s.form), MAX);
  await save('searches', next);
  return next;
}
export async function removeSavedSearch(id: string): Promise<SavedSearch[]> {
  const next = (await getSavedSearches()).filter((s) => s.id !== id);
  await save('searches', next);
  return next;
}
