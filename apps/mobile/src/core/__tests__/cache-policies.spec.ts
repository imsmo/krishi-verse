// Unit tests for the pure cache key builder + freshness decision.
import { buildCacheKey, decideFreshness, POLICY, type CacheEntry } from '../offline/cache-policies';

describe('buildCacheKey', () => {
  it('scopes by owner so accounts never collide', () => {
    expect(buildCacheKey('user-A', 'listings.mine', ['first', 30]))
      .not.toBe(buildCacheKey('user-B', 'listings.mine', ['first', 30]));
  });
  it('falls back to anon for empty scope', () => {
    expect(buildCacheKey('', 'ns')).toBe('kvcache:anon:ns');
  });
  it('omits empty/null parts deterministically', () => {
    expect(buildCacheKey('u', 'ns', [undefined, 'x', null, 2])).toBe('kvcache:u:ns:x|2');
  });
});

describe('decideFreshness', () => {
  const policy = { ttlMs: 1000, swrMs: 5000 };
  const at = (ageMs: number): CacheEntry => ({ value: 1, fetchedAt: 10_000 - ageMs });
  const now = 10_000;
  it('miss when no entry', () => expect(decideFreshness(undefined, now, policy)).toBe('miss'));
  it('fresh within ttl', () => expect(decideFreshness(at(500), now, policy)).toBe('fresh'));
  it('stale within swr window', () => expect(decideFreshness(at(3000), now, policy)).toBe('stale'));
  it('expired past ttl+swr', () => expect(decideFreshness(at(9000), now, policy)).toBe('expired'));
  it('treats future timestamps (clock skew) as fresh', () => expect(decideFreshness(at(-1000), now, policy)).toBe('fresh'));
  it('exposes sane default policies', () => {
    expect(POLICY.shortList.ttlMs).toBeGreaterThan(0);
    expect(POLICY.reference.swrMs).toBeGreaterThan(POLICY.shortList.swrMs);
  });
});
