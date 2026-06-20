// apps/mobile/src/features/listings/listings.api.ts · the farmer's listings data layer. Reads "my listings" and
// creates new ones through the platform API (SDK generic request escape-hatch — there is no dedicated
// seller-listings SDK method yet; the box=mine query is the API's owner filter). Creates are OFFLINE-FIRST: if
// the device is offline the op is enqueued (OfflineQueue) with a stable idempotency key and replayed later, so
// the farmer never loses a listing started in a low-signal field (Law 3 idempotency + Law 12 degrade-never-die).
import type { ListingCard, CreateListingInput } from '@krishi-verse/sdk-js';
import { apiClient } from '../../core/api/client';
import type { QueuedOp, ReplayResult } from '../../core/api/offline-queue';
import { registerOpHandler, enqueueOp } from '../../core/offline/sync-queue';
import { cache } from '../../core/offline/sqlite.db';
import { currentScope } from '../../core/offline/scope';
import { POLICY } from '../../core/offline/cache-policies';
import { newId } from '../../core/util/ids';

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

/** Start a paid boost. NOTE: `paymentTxnId` must come from a wallet debit (Law 2). The wallet-debit→txnId step
 * and the boost-tier lookup aren't exposed yet — so the boost SCREEN is deferred (see roadmap); this contract is
 * ready for when they land. */
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
