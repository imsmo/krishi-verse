// core/http/__tests__/rate-limit.spec.ts · fixed-window throttle (429 over limit).
import { RateLimitGuard } from '../rate-limit.guard';
import { InMemoryCacheService } from '../../cache/cache.service.in-memory';
import { TooManyRequestsError } from '../../../shared/errors/app-error';

function ctxFactory() {
  const res = { setHeader: jest.fn() };
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => ({ headers: {}, ip: '9.9.9.9' }), getResponse: () => res }),
    getClass: () => ({ name: 'TestController' }),
    getHandler: () => ({ name: 'hit' }),
  } as any;
}

describe('RateLimitGuard', () => {
  it('allows up to the limit then throws 429', async () => {
    const reflector: any = { getAllAndOverride: () => ({ limit: 2, windowSec: 60, by: 'ip' }) };
    const guard = new RateLimitGuard(reflector, new InMemoryCacheService());
    const ctx = ctxFactory();
    expect(await guard.canActivate(ctx)).toBe(true);
    expect(await guard.canActivate(ctx)).toBe(true);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(TooManyRequestsError);
  });
  it('fails OPEN if the cache throws (never takes the API down)', async () => {
    const reflector: any = { getAllAndOverride: () => ({ limit: 1, windowSec: 60, by: 'ip' }) };
    const brokenCache: any = { incr: async () => { throw new Error('redis down'); } };
    const guard = new RateLimitGuard(reflector, brokenCache);
    expect(await guard.canActivate(ctxFactory())).toBe(true);
  });
});
