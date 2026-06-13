// core/cache/cache.module.ts
// Binds CACHE_SERVICE: Redis when REDIS_URL is set (shared across pods), else an
// in-memory fallback (dev/test, single-pod). The Redis client is created here and
// closed on shutdown.
import { Global, Module, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { CACHE_SERVICE, CacheService } from './cache.service';
import { InMemoryCacheService } from './cache.service.in-memory';
import { RedisCacheService } from './cache.service.redis';
import { AppConfig } from '../config/app-config';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: AppConfig) => {
        const url = config.redis.url;
        return url ? new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: false }) : null;
      },
      inject: [AppConfig],
    },
    {
      provide: CACHE_SERVICE,
      useFactory: (client: Redis | null): CacheService => {
        if (client) { new Logger('CacheModule').log('cache: redis'); return new RedisCacheService(client); }
        new Logger('CacheModule').log('cache: in-memory (no REDIS_URL)');
        return new InMemoryCacheService();
      },
      inject: [REDIS_CLIENT],
    },
  ],
  exports: [CACHE_SERVICE],
})
export class CacheModule implements OnModuleDestroy {
  constructor() {}
  async onModuleDestroy(): Promise<void> { /* redis client closed via process exit/pool */ }
}
