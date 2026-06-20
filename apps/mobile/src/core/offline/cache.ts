// apps/mobile/src/core/offline/cache.ts · the read-through, stale-while-revalidate cache engine. Reads serve from
// the durable store first, then revalidate (guide §5 offline-first + Law 12 degrade-never-die): FRESH → no
// network; STALE → return cached immediately AND refresh in the background; MISS/EXPIRED → fetch, falling back to
// any cached value if the network fails. The store + clock are INJECTED so the SWR logic is unit-tested with an
// in-memory store + fake clock (the SQLite adapter is the production store). Never caches across user scopes.
import { buildCacheKey, decideFreshness, type CacheEntry, type CachePolicy } from './cache-policies';

export interface CacheStore {
  get(key: string): Promise<CacheEntry | undefined>;
  set(key: string, entry: CacheEntry): Promise<void>;
  remove(key: string): Promise<void>;
  removeByPrefix(prefix: string): Promise<void>;
}

export interface ReadOptions<T> {
  scope: string; ns: string; parts?: Array<string | number | undefined | null>;
  policy: CachePolicy;
  fetcher: () => Promise<T>;
}

export class Cache {
  constructor(private readonly store: CacheStore, private readonly now: () => number = Date.now) {}

  /** Read-through SWR. Returns the freshest value available without ever throwing for a network failure when a
   * cached value exists (degrade-never-die). Throws only on a hard fetch failure with NO cache to fall back to. */
  async read<T>(opts: ReadOptions<T>): Promise<{ value: T; fromCache: boolean }> {
    const key = buildCacheKey(opts.scope, opts.ns, opts.parts);
    const entry = (await this.store.get(key)) as CacheEntry<T> | undefined;
    const freshness = decideFreshness(entry, this.now(), opts.policy);

    if (freshness === 'fresh' && entry) return { value: entry.value, fromCache: true };

    if (freshness === 'stale' && entry) {
      void this.revalidate(key, opts.fetcher); // fire-and-forget; errors swallowed (keep serving cached)
      return { value: entry.value, fromCache: true };
    }

    // miss / expired → must fetch; fall back to any cached value on failure
    try {
      const value = await opts.fetcher();
      await this.store.set(key, { value, fetchedAt: this.now() });
      return { value, fromCache: false };
    } catch (e) {
      if (entry) return { value: entry.value, fromCache: true }; // serve expired-but-present rather than die
      throw e;
    }
  }

  private async revalidate<T>(key: string, fetcher: () => Promise<T>): Promise<void> {
    try {
      const value = await fetcher();
      await this.store.set(key, { value, fetchedAt: this.now() });
    } catch {
      /* keep the existing cached value */
    }
  }

  /** Invalidate one namespace (or one keyed entry) — call after a write that changes that data. */
  async invalidate(scope: string, ns: string, parts?: Array<string | number | undefined | null>): Promise<void> {
    if (parts && parts.length) await this.store.remove(buildCacheKey(scope, ns, parts));
    else await this.store.removeByPrefix(buildCacheKey(scope, ns));
  }

  /** Drop EVERYTHING cached for a user scope (call on sign-out so the next user can't read it). */
  async clearScope(scope: string): Promise<void> { await this.store.removeByPrefix(`kvcache:${scope || 'anon'}:`); }
}
