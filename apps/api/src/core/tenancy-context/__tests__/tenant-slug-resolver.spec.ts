// core/tenancy-context/__tests__/tenant-slug-resolver.spec.ts
// Unit tests for the storefront slug → tenant-uuid resolver (mocked pg pool). Verifies: malformed slugs never
// touch the DB; a live tenant resolves; positive + negative results are cached; a DB error degrades to null WITHOUT
// caching (so the next request retries). Real RLS/registry behaviour is exercised by the integration/e2e suites.
import { TenantSlugResolver } from '../tenant-slug-resolver';

const TENANT = '88888888-0000-7000-8000-000000000001';

function makePools(rowsFor: (sql: string, params: unknown[]) => unknown[], onCall?: () => void) {
  let calls = 0;
  const pool = {
    query: async (sql: string, params: unknown[]) => {
      calls++;
      onCall?.();
      return { rows: rowsFor(sql, params) };
    },
  };
  return { provider: { writer: () => pool } as any, calls: () => calls };
}

describe('TenantSlugResolver', () => {
  it('rejects malformed slugs without hitting the DB', async () => {
    const p = makePools(() => [{ id: TENANT }]);
    const r = new TenantSlugResolver(p.provider);
    expect(await r.resolve('')).toBeNull();
    expect(await r.resolve('not a slug!')).toBeNull();
    expect(await r.resolve('a'.repeat(60))).toBeNull(); // > 50 chars
    expect(p.calls()).toBe(0);
  });

  it('resolves a live tenant and filters on a browsable status', async () => {
    let seenSql = '';
    let seenParams: unknown[] = [];
    const p = makePools((sql, params) => { seenSql = sql; seenParams = params; return [{ id: TENANT }]; });
    const r = new TenantSlugResolver(p.provider);
    expect(await r.resolve('demo-fpo')).toBe(TENANT);
    expect(seenParams).toEqual(['demo-fpo']);
    expect(seenSql).toMatch(/status IN \('trial','active','grace'\)/);
  });

  it('lower-cases the slug and caches positive hits (one DB call per slug)', async () => {
    const p = makePools(() => [{ id: TENANT }]);
    const r = new TenantSlugResolver(p.provider);
    expect(await r.resolve('Demo-FPO')).toBe(TENANT);
    expect(await r.resolve('demo-fpo')).toBe(TENANT); // served from cache
    expect(p.calls()).toBe(1);
  });

  it('caches a miss (unknown slug) so it does not re-query within the TTL', async () => {
    const p = makePools(() => []);
    const r = new TenantSlugResolver(p.provider);
    expect(await r.resolve('ghost')).toBeNull();
    expect(await r.resolve('ghost')).toBeNull();
    expect(p.calls()).toBe(1);
  });

  it('degrades to null on a DB error and does NOT cache (retries next time)', async () => {
    let throwIt = true;
    const pool = { query: async () => { if (throwIt) throw new Error('pg down'); return { rows: [{ id: TENANT }] }; } };
    const r = new TenantSlugResolver({ writer: () => pool } as any);
    expect(await r.resolve('demo-fpo')).toBeNull();
    throwIt = false;
    expect(await r.resolve('demo-fpo')).toBe(TENANT); // not pinned to the failed result
  });
});
