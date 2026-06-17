// modules/catalogue/__tests__/tenant-isolation.spec.ts · tenant-scoping SQL contract (CI gate).
import { ProductRepository } from '../repositories/product.repository';
import { CategoryRepository } from '../repositories/category.repository';

function fakeReplica() { const exec = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }; return { provider: { forTenant: () => exec } as any, exec }; }

describe('catalogue tenant isolation', () => {
  it('product.getVisibleById allows platform OR own tenant only', async () => {
    const { provider, exec } = fakeReplica();
    await new ProductRepository(provider).getVisibleById('tenantA', 'p1');
    const [sql, params] = exec.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id IS NULL OR tenant_id=\$2/);
    expect(params).toEqual(['p1', 'tenantA']);
  });
  it('product.getForUpdate is tenant-private + row-locked', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new ProductRepository({ forTenant: () => tx } as any).getForUpdate(tx as any, 'tenantA', 'p1');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/FOR UPDATE/);
    expect(sql).toMatch(/tenant_id=\$2/);
    expect(params).toEqual(['p1', 'tenantA']);
  });
  it('category.toggleTenantCategory binds tenant_id', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new CategoryRepository({ forTenant: () => tx } as any).toggleTenantCategory(tx as any, 'tenantA', 'c1', true);
    const [, params] = tx.query.mock.calls[0];
    expect(params[0]).toBe('tenantA');
  });
});
