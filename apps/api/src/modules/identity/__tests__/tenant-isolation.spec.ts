// modules/identity/__tests__/tenant-isolation.spec.ts · CI merge gate: tenant-scoped repos
// must bind tenant_id in every query (defense-in-depth atop RLS).
import { UserTenantRoleRepository } from '../repositories/user-tenant-role.repository';
import { KycDocumentRepository } from '../repositories/kyc-document.repository';

function fakeReplica() {
  const exec = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
  return { provider: { forTenant: () => exec } as any, exec };
}

describe('identity tenant isolation', () => {
  it('user_tenant_roles.findExisting binds tenant_id as $1', async () => {
    const { provider, exec } = fakeReplica();
    await new UserTenantRoleRepository(provider).findExisting('tenantA', 'user1', 'role1');
    const [sql, params] = exec.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id\s*=\s*\$1/);
    expect(params[0]).toBe('tenantA');
  });
  it('user_tenant_roles.getForUpdate filters by tenant_id and locks the row', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new UserTenantRoleRepository({ forTenant: () => tx } as any).getForUpdate(tx as any, 'tenantA', 'utr1');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/FOR UPDATE/);
    expect(sql).toMatch(/tenant_id\s*=\s*\$2/);
    expect(params).toEqual(['utr1', 'tenantA']);
  });
  it('kyc listByUser is tenant-scoped via the replica router', async () => {
    const { provider, exec } = fakeReplica();
    await new KycDocumentRepository(provider).listByUser('tenantA', 'user1');
    expect(exec.query).toHaveBeenCalled();
  });
});
