// core/cache/cache.service.in-memory.ts
// Process-local cache used in dev/test and as a safe fallback when REDIS_URL is
// not configured. Same contract as Redis; obviously not shared across pods, so
// production binds the Redis implementation. TTL is honoured; expired keys are
// evicted lazily on read.
import { Injectable } from '@nestjs/common';
import { CacheService } from './cache.service';

interface Entry { value: unknown; expiresAt: number; }

@Injectable()
export class InMemoryCacheService extends CacheService {
  private readonly store = new Map<string, Entry>();

  async get<T>(key: string): Promise<T | null> {
    const e = this.store.get(key);
    if (!e) return null;
    if (e.expiresAt < Date.now()) { this.store.delete(key); return null; }
    return e.value as T;
  }
  async set<T>(key: string, val: T, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value: val, expiresAt: Date.now() + ttlSeconds * 1000 });
  }
  async del(key: string): Promise<void> { this.store.delete(key); }
  async incr(key: string, ttlSeconds: number): Promise<number> {
    const e = this.store.get(key);
    const now = Date.now();
    if (!e || e.expiresAt < now) { this.store.set(key, { value: 1, expiresAt: now + ttlSeconds * 1000 }); return 1; }
    const next = (typeof e.value === 'number' ? e.value : 0) + 1;
    e.value = next; // keep original expiry (fixed window)
    return next;
  }
  async wrap<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
    const hit = await this.get<T>(key);
    if (hit !== null) return hit;
    const fresh = await load();
    if (fresh !== null && fresh !== undefined) await this.set(key, fresh, ttlSeconds);
    return fresh;
  }
}
