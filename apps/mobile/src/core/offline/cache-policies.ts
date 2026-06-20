// apps/mobile/src/core/offline/cache-policies.ts · the PURE rules behind the offline read-cache: how cache keys
// are built (scoped per user so one account can NEVER read another's cached data — anti-IDOR, guide §4) and how
// freshness is decided (fresh → serve; stale → serve + revalidate in the background = stale-while-revalidate;
// expired/miss → must fetch). No I/O, no React → fully unit-tested. The SQLite store + the read-through engine
// are thin shells around these decisions.

export interface CacheEntry<T = unknown> { value: T; fetchedAt: number }

export interface CachePolicy {
  /** Within ttlMs of fetch the entry is FRESH (serve without a network call). */
  ttlMs: number;
  /** After ttlMs but within ttlMs+swrMs it is STALE (serve immediately AND revalidate). 0 = no SWR window. */
  swrMs: number;
}

export type Freshness = 'fresh' | 'stale' | 'expired' | 'miss';

/** Build a cache key. `scope` is the data owner (user id, or 'anon') so cached reads never cross accounts;
 * `ns` is the logical collection; `parts` are the query discriminators. */
export function buildCacheKey(scope: string, ns: string, parts: Array<string | number | undefined | null> = []): string {
  const tail = parts.filter((p) => p !== undefined && p !== null && p !== '').map(String).join('|');
  return `kvcache:${scope || 'anon'}:${ns}${tail ? ':' + tail : ''}`;
}

/** Decide freshness of an entry given the clock + policy. A missing entry is 'miss'. */
export function decideFreshness(entry: CacheEntry | undefined | null, nowMs: number, policy: CachePolicy): Freshness {
  if (!entry) return 'miss';
  const age = nowMs - entry.fetchedAt;
  if (age < 0) return 'fresh'; // clock skew / future timestamp — treat as fresh, never negative-age fetch
  if (age <= policy.ttlMs) return 'fresh';
  if (age <= policy.ttlMs + policy.swrMs) return 'stale';
  return 'expired';
}

/** Common policies. Tune per data type; lists are short-lived, reference data lives longer. */
export const POLICY = {
  shortList: { ttlMs: 60_000, swrMs: 10 * 60_000 } as CachePolicy,          // 1 min fresh, 10 min SWR
  reference: { ttlMs: 60 * 60_000, swrMs: 24 * 60 * 60_000 } as CachePolicy, // 1 h fresh, 1 day SWR
} as const;
