// apps/mobile/src/features/listings/listings.api.ts · the farmer's listings data layer. Reads "my listings" and
// creates new ones through the platform API (SDK generic request escape-hatch — there is no dedicated
// seller-listings SDK method yet; the box=mine query is the API's owner filter). Creates are OFFLINE-FIRST: if
// the device is offline the op is enqueued (OfflineQueue) with a stable idempotency key and replayed later, so
// the farmer never loses a listing started in a low-signal field (Law 3 idempotency + Law 12 degrade-never-die).
import type { ListingCard, CreateListingInput, ListingAnalytics, GalleryItem, BoostTier, BoostWalletPayResult } from '@krishi-verse/sdk-js';
import { apiClient } from '../../core/api/client';
import type { QueuedOp, ReplayResult } from '../../core/api/offline-queue';
import { registerOpHandler, enqueueOp } from '../../core/offline/sync-queue';
import { cache } from '../../core/offline/sqlite.db';
import { currentScope } from '../../core/offline/scope';
import { POLICY } from '../../core/offline/cache-policies';
import { newId } from '../../core/util/ids';
import { track, EVENTS } from '../../core/observability';

export type { CreateListingInput };

export const LISTING_CREATE_OP = 'listing.create';

type ListingsPage = { items: ListingCard[]; nextCursor: string | null };

/** My listings (owner box), keyset paginated. Read-through SWR cache (usable offline); on a hard failure with no
 * cache, degrades to an empty page (caller shows empty state). Cache is scoped to the current user. */
export async function myListings(cursor?: string, limit = 30): Promise<ListingsPage> {
  try {
    const { value } = await cache.read<ListingsPage>({
      scope: currentScope(), ns: 'listings.mine', parts: [cursor ?? 'first', limit], policy: POLICY.shortList,
      fetcher: async () => {
        const r = await apiClient().request<ListingCard[]>('GET', 'listings', { query: { box: 'mine', cursor, limit } });
        return { items: r.data ?? [], nextCursor: (r.meta?.nextCursor as string | null) ?? null };
      },
    });
    return value;
  } catch {
    return { items: [], nextCursor: null };
  }
}

/** A single owned listing by id (authenticated owner read), cached. Returns null on not-found/failure (caller
 * degrades). `status` is the HTTP status when known, so the screen can distinguish 404 from a transient failure. */
export async function getListing(id: string): Promise<{ listing: ListingCard | null; status: number }> {
  try {
    const { value } = await cache.read<ListingCard>({
      scope: currentScope(), ns: 'listings.detail', parts: [id], policy: POLICY.shortList,
      fetcher: async () => (await apiClient().request<ListingCard>('GET', `listings/${encodeURIComponent(id)}`)).data,
    });
    return { listing: value, status: 200 };
  } catch (e: unknown) {
    return { listing: null, status: (e as { status?: number })?.status ?? 0 };
  }
}

/** Owner engagement analytics for screen 112 (views/offers/price-changes/boosts + publishedAt). Owner-only on the
 * server (404 for non-owners — anti-IDOR). Degrades to null on failure so the detail screen hides the stats. */
export async function listingAnalytics(id: string): Promise<ListingAnalytics | null> {
  try { return await apiClient().listings.analytics(id); } catch { return null; }
}

/** The listing's photo gallery (ordered). Degrades to [] on failure (the screen shows 0 photos, never a fake count). */
export async function listingMedia(id: string): Promise<GalleryItem[]> {
  try { return await apiClient().listings.media(id); } catch { return []; }
}

/** Create a listing (draft). Tries the API immediately; on a NETWORK/timeout failure (offline field) it enqueues
 * the op for later replay and returns { queued: true } (no id yet). A validation/permission error (4xx) is
 * rethrown so the screen can show what to fix. The idempotency key is shared between the live attempt and the
 * queued op, so a replay can never double-create. `mediaIds` are confirmed uploads (core/media). */
export async function createListing(input: CreateListingInput): Promise<{ id?: string; queued: boolean }> {
  const idempotencyKey = newId();
  const body: CreateListingInput = { ...input, currencyCode: input.currencyCode ?? 'INR' };
  try {
    const { id } = await apiClient().listings.create(body, idempotencyKey);
    await cache.invalidate(currentScope(), 'listings.mine'); // new listing should appear on next read
    track(EVENTS.listingCreateSuccess); // funnel (consent-gated, no PII) — §6
    return { id, queued: false };
  } catch (e: unknown) {
    const status = (e as { status?: number })?.status ?? 0;
    if (status >= 400 && status < 500 && status !== 408 && status !== 429) throw e; // real client error — surface it
    await enqueueOp({ type: LISTING_CREATE_OP, payload: body, idempotencyKey, id: idempotencyKey, now: Date.now() });
    return { queued: true };
  }
}

/** Publish a draft listing, then invalidate the owner list/detail caches so the change shows. */
export async function publishListing(id: string): Promise<{ ok: boolean }> {
  const res = await apiClient().listings.publish(id);
  await cache.invalidate(currentScope(), 'listings.mine');
  await cache.invalidate(currentScope(), 'listings.detail', [id]);
  return res;
}

/** Change a listing's price (optimistic version). Money is a bigint minor-unit string (Law 2). */
export async function changeListingPrice(id: string, priceMinor: string, expectedVersion: number): Promise<{ ok: boolean }> {
  const res = await apiClient().listings.changePrice(id, priceMinor, expectedVersion);
  await cache.invalidate(currentScope(), 'listings.mine');
  await cache.invalidate(currentScope(), 'listings.detail', [id]);
  return res;
}

/** Repost an expired/sold-out listing back live for a fresh window (screen 116). Optionally updates the price in
 * the same op (paise BigInt — Law 2). Errors are RETHROWN so the screen can surface a validation/conflict message
 * (e.g. an illegal source state). On success the owner list/detail caches are invalidated so the change shows. */
export async function repostListing(id: string, opts: { newPriceMinor?: string; durationDays?: number } = {}): Promise<{ ok: boolean }> {
  const res = await apiClient().listings.repost(id, opts);
  await cache.invalidate(currentScope(), 'listings.mine');
  await cache.invalidate(currentScope(), 'listings.detail', [id]);
  return res;
}

/** The paid-boost tier catalogue (screen 114). id/name/price/days are server truth; degrades to [] on failure so
 * the screen shows its empty state (never a fabricated tier or price). */
export async function loadBoostTiers(): Promise<BoostTier[]> {
  try { return await apiClient().listings.boostTiers(); } catch { return []; }
}

/** Pay for a boost STRAIGHT FROM THE WALLET (screen 114). The client sends only the listing id + chosen tier id;
 * the SERVER resolves the price and debits the wallet atomically (fails closed on insufficient balance — Law 2).
 * Idempotency-keyed (Law 3): the caller passes a key stable across re-taps so a retry can never double-charge.
 * On success the owner list/detail caches are invalidated so the boosted state shows. Errors are RETHROWN (a
 * wallet/validation failure must surface to the user — boosting is an online, immediate-feedback action, not a
 * silently-queued write). */
export async function payListingBoost(id: string, boostTierId: string, idempotencyKey: string, currencyCode?: string): Promise<BoostWalletPayResult> {
  const res = await apiClient().listings.payBoostFromWallet(id, boostTierId, idempotencyKey, currencyCode);
  await cache.invalidate(currentScope(), 'listings.mine');
  await cache.invalidate(currentScope(), 'listings.detail', [id]);
  track(EVENTS.listingCreateSuccess); // reuse the seller funnel bucket (consent-gated, no PII) — §6
  return res;
}

/** Lower-level boost start (records a boost against an already-captured wallet txn). Retained for callers that do
 * the wallet debit themselves; screen 114 uses payListingBoost (server-resolved) instead. `paymentTxnId` proves
 * the wallet already captured payment (Law 2). */
export async function startBoost(id: string, dto: { boostTierId: string; priceMinor: string; currencyCode?: string; days: number; paymentTxnId: string }): Promise<{ ok: boolean }> {
  return apiClient().listings.startBoost(id, dto, newId());
}

/** The replay handler, registered on the shared offline queue (dispatched by op.type). */
async function replayListingCreate(op: QueuedOp): Promise<ReplayResult> {
  try {
    await apiClient().listings.create(op.payload as CreateListingInput, op.idempotencyKey);
    return 'ok';
  } catch (e: unknown) {
    const status = (e as { status?: number })?.status ?? 0;
    if (status >= 400 && status < 500 && status !== 408 && status !== 429) return 'permanent-fail';
    return 'retry';
  }
}
registerOpHandler(LISTING_CREATE_OP, replayListingCreate);
