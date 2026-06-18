// modules/requirements/__tests__/tenant-isolation.spec.ts · tenant-scoping SQL contract (CI gate).
// Every requirement/response read/write binds tenant_id (Law 1). No version columns → mutations lock
// the row FOR UPDATE; lists are keyset (never OFFSET); the expiry finders are bounded + SKIP LOCKED.
import { RequirementRepository } from '../repositories/requirement.repository';
import { RequirementResponseRepository } from '../repositories/requirement-response.repository';
import { Requirement } from '../domain/requirement.entity';
import { RequirementResponse } from '../domain/requirement-response.entity';

function fakeReplica() { const exec = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }; return { provider: { forTenant: () => exec } as any, exec }; }
const reqRepo = () => new RequirementRepository(fakeReplica().provider);
const respRepo = () => new RequirementResponseRepository(fakeReplica().provider);

describe('requirements tenant isolation (SQL contract)', () => {
  it('requirement.getForUpdate binds tenant_id + row-locks (no version → FOR UPDATE)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await reqRepo().getForUpdate(tx as any, 'tenantA', 'r1');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/id=\$1 AND tenant_id=\$2/); expect(sql).toMatch(/FOR UPDATE/);
    expect(params).toEqual(['r1', 'tenantA']);
  });
  it('requirement.update is tenant-scoped with NO version clause', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    const r = Requirement.post({ id: 'r1', tenantId: 'tenantA', buyerUserId: 'b1', title: 'x', quantity: '5', unitCode: 'quintal' });
    await reqRepo().update(tx as any, r);
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/WHERE id=\$1 AND tenant_id=\$2/); expect(sql).not.toMatch(/version/);
    expect(params[1]).toBe('tenantA');
  });
  it('requirement.listOpen is keyset (no OFFSET) and tenant-scoped', async () => {
    const { provider, exec } = fakeReplica();
    await new RequirementRepository(provider).listOpen('tenantA', { limit: 20 });
    const [sql, params] = exec.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id=\$1 AND status IN \('open','partially_matched'\)/);
    expect(sql).toMatch(/ORDER BY created_at DESC, id DESC/); expect(sql).not.toMatch(/OFFSET/i);
    expect(params[0]).toBe('tenantA');
  });
  it('requirement.findDueToExpire is bounded + SKIP LOCKED', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await reqRepo().findDueToExpire(tx as any, new Date(), 100);
    const [sql] = tx.query.mock.calls[0];
    expect(sql).toMatch(/need_by IS NOT NULL AND need_by < \$1::date/); expect(sql).toMatch(/FOR UPDATE SKIP LOCKED/);
  });

  it('response.getForUpdate binds tenant_id + FOR UPDATE', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await respRepo().getForUpdate(tx as any, 'tenantA', 'q1');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/id=\$1 AND tenant_id=\$2/); expect(sql).toMatch(/FOR UPDATE/);
    expect(params).toEqual(['q1', 'tenantA']);
  });
  it('response.insert binds tenant_id + ON CONFLICT (uniqueness guard), no version', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    const r = RequirementResponse.submit({ id: 'q1', requirementId: 'r1', tenantId: 'tenantA', sellerUserId: 's1', listingId: 'l1', quotedPriceMinor: 1000n, quantity: '1' });
    await respRepo().insert(tx as any, r);
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO requirement_responses/); expect(sql).toMatch(/ON CONFLICT \(requirement_id, seller_user_id\) DO NOTHING/);
    expect(sql).not.toMatch(/version/); expect(params).toContain('tenantA');
  });
  it('response.listForRequirement binds tenant_id + requirement_id, keyset (no OFFSET)', async () => {
    const { provider, exec } = fakeReplica();
    await new RequirementResponseRepository(provider).listForRequirement('tenantA', 'r1', { limit: 50 });
    const [sql, params] = exec.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id=\$1 AND requirement_id=\$2/); expect(sql).not.toMatch(/OFFSET/i);
    expect(params).toEqual(['tenantA', 'r1', 50]);
  });
  it('response.findDueToExpire is bounded + SKIP LOCKED over submitted|shortlisted', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await respRepo().findDueToExpire(tx as any, new Date(), 100);
    const [sql] = tx.query.mock.calls[0];
    expect(sql).toMatch(/status IN \('submitted','shortlisted'\) AND valid_until IS NOT NULL AND valid_until < \$1/);
    expect(sql).toMatch(/FOR UPDATE SKIP LOCKED/);
  });
});
