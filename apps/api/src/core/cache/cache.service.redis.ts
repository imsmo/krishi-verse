// core/cache/cache.service.redis.ts
// Redis-backed cache for production (shared across pods). Values are JSON; all
// keys are already tenant-prefixed by callers (cache-keys.ts). `wrap` is a plain
// cache-aside (no stampede lock here — hot keys that need it use a dedicated
// lock; most listing reads tolerate a brief miss storm).
import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { CacheService } from './cache.service';

@Injectable()
export class RedisCacheService extends CacheService {
  private readonly log = new Logger(RedisCacheService.name);
  constructor(private readonly client: Redis) { super(); }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }
  async set<T>(key: string, val: T, ttlSeconds: number): Promise<void> {
    await this.client.set(key, JSON.stringify(val), 'EX', ttlSeconds);
  }
  async del(key: string): Promise<void> { await this.client.del(key); }
  async incr(key: string, ttlSeconds: number): Promise<number> {
    const n = await this.client.incr(key);
    if (n === 1) await this.client.expire(key, ttlSeconds); // set TTL only on the first hit of the window
    return n;
  }
  async wrap<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
    const hit = await this.get<T>(key);
    if (hit !== null) return hit;
    const fresh = await load();
    if (fresh !== null && fresh !== undefined) await this.set(key, fresh, ttlSeconds);
    return fresh;
  }
}
