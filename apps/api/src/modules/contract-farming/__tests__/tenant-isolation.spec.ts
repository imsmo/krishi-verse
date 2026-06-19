// modules/contract-farming/__tests__/tenant-isolation.spec.ts · tenant-scoping SQL contract (CI gate).
// Every contract/grower/milestone/advance read+write binds tenant_id (Law 1). No version columns → mutations
// lock FOR UPDATE. Templates browse includes platform-standard (NULL-tenant) rows. Advance recovery locks
// FOR UPDATE. Lists are keyset (never OFFSET).
import { ContractTemplateRepository } from '../repositories/contract-template.repository';
import { FarmingContractRepository } from '../repositories/farming-contract.repository';
import { ContractGrowerRepository } from '../repositories/contract-grower.repository';
import { InputAdvanceRepository } from '../repositories/input-advance.repository';
import { FarmingContract } from '../domain/farming-contract.entity';
import { ContractGrower } from '../domain/contract-grower.entity';

function fakeReplica() { const exec = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }; return { provider: { forTenant: () => exec } as any, exec }; }
const contract = () => FarmingContract.create({ id: 'c1', tenantId: 'tA', contractNo: 'CF-X', templateId: null, buyerUserId: 'b1', contractKind: 'forward', productId: 'p1', totalQuantityMilli: 1000n, unitCode: 'quintal', priceModel: 'fixed', priceTerms: { fixed_minor: '1' }, qualitySpec: {}, season: null });

describe('contract_templates browse includes platform-standard (NULL tenant)', () => {
  it('getUsable reads own-OR-NULL', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new ContractTemplateRepository(fakeReplica().provider).getUsable('tA', 'tpl1', tx as any);
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/id=\$1 AND \(tenant_id=\$2 OR tenant_id IS NULL\)/); expect(params).toEqual(['tpl1', 'tA']);
  });
  it('list includes NULL-tenant; no OFFSET', async () => {
    const { provider, exec } = fakeReplica();
    await new ContractTemplateRepository(provider).list('tA', true);
    const [sql] = exec.query.mock.calls[0];
    expect(sql).toMatch(/\(tenant_id=\$1 OR tenant_id IS NULL\)/); expect(sql).not.toMatch(/OFFSET/i);
  });
});

describe('farming_contracts isolation', () => {
  it('getForUpdate binds tenant_id + FOR UPDATE', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new FarmingContractRepository(fakeReplica().provider).getForUpdate(tx as any, 'tA', 'c1');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/id=\$1 AND tenant_id=\$2/); expect(sql).toMatch(/FOR UPDATE/); expect(params).toEqual(['c1', 'tA']);
  });
  it('insert binds tenant_id; listFor keyset (no OFFSET)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    await new FarmingContractRepository(fakeReplica().provider).insert(tx as any, contract());
    expect(tx.query.mock.calls[0][0]).toMatch(/INSERT INTO farming_contracts/); expect(tx.query.mock.calls[0][1]).toContain('tA');
    const { provider, exec } = fakeReplica();
    await new FarmingContractRepository(provider).listFor('tA', { limit: 50 });
    expect(exec.query.mock.calls[0][0]).not.toMatch(/OFFSET/i);
  });
});

describe('contract_growers + input_advances isolation', () => {
  it('grower insert binds tenant_id; listForContract tenant+contract', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    const g = ContractGrower.enrol({ id: 'g1', contractId: 'c1', tenantId: 'tA', farmerUserId: 'f1', landParcelId: null, committedQuantityMilli: 1000n });
    await new ContractGrowerRepository(fakeReplica().provider).insert(tx as any, g);
    expect(tx.query.mock.calls[0][1]).toContain('tA');
    const { provider, exec } = fakeReplica();
    await new ContractGrowerRepository(provider).listForContract('tA', 'c1');
    expect(exec.query.mock.calls[0][1]).toEqual(['tA', 'c1']);
  });
  it('advance recovery is tenant-bound + outstanding + FOR UPDATE (oldest first)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new InputAdvanceRepository(fakeReplica().provider).listOutstandingForUpdate(tx as any, 'tA', 'g1');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id=\$1 AND grower_id=\$2 AND recovered_minor < value_minor/); expect(sql).toMatch(/ORDER BY created_at FOR UPDATE/);
    expect(params).toEqual(['tA', 'g1']);
  });
});
