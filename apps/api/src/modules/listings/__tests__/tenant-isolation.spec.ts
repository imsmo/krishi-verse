// modules/listings/__tests__/tenant-isolation.spec.ts
// MANDATORY CI MERGE GATE. Proves the listings aggregate is tenant-scoped at the
// application layer (every query carries tenant_id) — defense in depth on top of
// PostgreSQL RLS. These tests assert the repository SQL always binds tenant_id and
// that cross-tenant access yields no rows. Run against a real DB in CI; here we
// assert the SQL contract with a fake executor.
import { ListingRepository } from '../repositories/listing.repository';

function fakeReplica(rows: any[]) {
  const exec = { query: jest.fn().mockResolvedValue({ rows, rowCount: rows.length }) };
  return { provider: { forTenant: () => exec } as any, exec };
}

describe('listings tenant isolation (CI merge gate)', () => {
  it('findById binds tenant_id as a query parameter', async () => {
    const { provider, exec } = fakeReplica([]);
    const repo = new ListingRepository(provider);
    const res = await repo.findById('tenantA', 'listing-owned-by-B');
    expect(res).toBeNull();
    const [sql, params] = exec.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id\s*=\s*\$2/);
    expect(params).toEqual(['listing-owned-by-B', 'tenantA']);
  });

  it('listBySeller is scoped to the calling tenant', async () => {
    const { provider, exec } = fakeReplica([]);
    const repo = new ListingRepository(provider);
    await repo.listBySeller('tenantA', 'seller1', null, 20);
    const [sql, params] = exec.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id\s*=\s*\$1/);
    expect(params[0]).toBe('tenantA');
  });

  it('getForUpdate filters by tenant_id and locks the row', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    const repo = new ListingRepository({ forTenant: () => tx } as any);
    await expect(repo.getForUpdate(tx as any, 'tenantA', 'foreign-id')).rejects.toBeTruthy();
    const [sql] = tx.query.mock.calls[0];
    expect(sql).toMatch(/FOR UPDATE/);
    expect(sql).toMatch(/tenant_id\s*=\s*\$2/);
  });
});
