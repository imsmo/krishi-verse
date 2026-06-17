// core/cache/cache.service.ts · Redis cache abstraction. ALL keys tenant-prefixed.
export abstract class CacheService {
  abstract get<T>(key: string): Promise<T | null>;
  abstract set<T>(key: string, val: T, ttlSeconds: number): Promise<void>;
  abstract del(key: string): Promise<void>;
  /** cache-aside helper */
  abstract wrap<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T>;
  /** Atomic increment with TTL set on first touch. Returns the new counter value. Used by rate limiting. */
  abstract incr(key: string, ttlSeconds: number): Promise<number>;
}
export const CACHE_SERVICE = Symbol('CACHE_SERVICE');
