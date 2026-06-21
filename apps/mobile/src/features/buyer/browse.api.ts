// apps/mobile/src/features/buyer/browse.api.ts · data layer for the buyer browse/search/detail surface (P-08).
// Keeps screens thin (guide §3). The public catalogue is ANONYMOUS (SDK browse/get send no token), keyset-paged,
// and read through the SWR cache so a repeat search is instant + usable on 3G/offline (DoD: results <2s via cache).
// Degrade-never-die: a hard failure → an empty page / null, never a crash. Money stays bigint-minor (Law 2) — the
// screen formats via MoneyText. Cache is scoped (anon-safe): the public catalogue is the same for everyone, so we
// scope it under a fixed 'public' bucket rather than the user, and never cache another tenant's private data.
import type { ListingCard, ListingQuery, ReviewSummary } from '@krishi-verse/sdk-js';
import { apiClient } from '../../core/api/client';
import { cache } from '../../core/offline/sqlite.db';
import { POLICY } from '../../core/offline/cache-policies';

export interface BrowsePage { items: ListingCard[]; nextCursor: string | null; total: number | null }

const PUBLIC_SCOPE = 'public';

/** Browse/search published listings (anonymous, keyset). Read-through SWR cache keyed by the full query, so the
 * same search serves instantly then revalidates. Degrades to an empty page. */
export async function browseListings(query: ListingQuery): Promise<BrowsePage> {
  try {
    const { value } = await cache.read<BrowsePage>({
      scope: PUBLIC_SCOPE, ns: 'browse', parts: [JSON.stringify(query)], policy: POLICY.shortList,
      fetcher: async () => {
        const page = await apiClient().listings.browse(query);
        return { items: page.items, nextCursor: page.nextCursor, total: page.total ?? null };
      },
    });
    return value;
  } catch { return { items: [], nextCursor: null, total: null }; }
}

/** A single published listing by id (anonymous, public/visibility-gated). Cached; null on not-found/failure. */
export async function getPublicListing(id: string): Promise<ListingCard | null> {
  try {
    const { value } = await cache.read<ListingCard>({
      scope: PUBLIC_SCOPE, ns: 'browse.detail', parts: [id], policy: POLICY.shortList,
      fetcher: () => apiClient().listings.get(id),
    });
    return value;
  } catch { return null; }
}

/** A seller's aggregate rating (real). Degrades to a zero summary. NOTE: there is no public seller-profile
 * endpoint yet (name/bio/their listings) — the seller screen shows this summary + flags the rest (roadmap). */
export async function sellerSummary(sellerUserId: string): Promise<ReviewSummary> {
  try { return await apiClient().reviews.summary({ targetUserId: sellerUserId }); }
  catch { return { averageStars: 0, count: 0 }; }
}
