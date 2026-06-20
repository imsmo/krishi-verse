// core/bulk/__tests__/tenant-isolation.spec.ts · scoping SQL contract (CI gate).
// bulk_import_jobs + bulk_import_errors bind tenant_id on every query; the processor's claim/finish lock the row
// FOR UPDATE (no version column); lists are KEYSET (no OFFSET). Inserts carry tenant_id.
import { BulkImportJobRepository } from '../bulk-import-job.repository';
import { BulkResultStore } from '../bulk-result.store';
import { BulkImportJob } from '../domain/bulk-import-job.entity';

function fakeReplica() { const exec = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }; return { provider: { forTenant: () => exec } as any, exec }; }
const job = () => BulkImportJob.create({ id: 'j1', tenantId: 'tenantA', importType: 'products', storageKey: 'k', requestedBy: 'u1' });

describe('bulk_import_jobs isolation', () => {
  it('getForUpdate binds tenant_id + FOR UPDATE; insert binds tenant_id', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new BulkImportJobRepository(fakeReplica().provider).getForUpdate(tx as any, 'tenantA', 'j1');
    expect(tx.query.mock.calls[0][0]).toMatch(/id=\$1 AND tenant_id=\$2/);
    expect(tx.query.mock.calls[0][0]).toMatch(/FOR UPDATE/);
    const tx2 = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    await new BulkImportJobRepository(fakeReplica().provider).insert(tx2 as any, job());
    expect(tx2.query.mock.calls[0][0]).toMatch(/INSERT INTO bulk_import_jobs/);
    expect(tx2.query.mock.calls[0][1]).toContain('tenantA');
  });
  it('list keyset (no OFFSET) + tenant-bound; countActive tenant-bound', async () => {
    const { provider, exec } = fakeReplica();
    await new BulkImportJobRepository(provider).listFor('tenantA', { limit: 50 });
    expect(exec.query.mock.calls[0][0]).toMatch(/tenant_id=\$1/);
    expect(exec.query.mock.calls[0][0]).toMatch(/ORDER BY created_at DESC, id DESC/);
    expect(exec.query.mock.calls[0][0]).not.toMatch(/OFFSET/i);
    const r2 = fakeReplica();
    await new BulkImportJobRepository(r2.provider).countActive('tenantA');
    expect(r2.exec.query.mock.calls[0][0]).toMatch(/tenant_id=\$1/);
  });
});

describe('bulk_import_errors isolation', () => {
  it('recordError binds tenant_id; listErrors tenant-bound + keyset (no OFFSET)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    await new BulkResultStore(fakeReplica().provider).recordError(tx as any, { tenantId: 'tenantA', jobId: 'j1', rowIndex: 3, errorCode: 'X', errorMessage: 'm' });
    expect(tx.query.mock.calls[0][0]).toMatch(/INSERT INTO bulk_import_errors/);
    expect(tx.query.mock.calls[0][1]).toContain('tenantA');
    const { provider, exec } = fakeReplica();
    await new BulkResultStore(provider).listErrors('tenantA', 'j1', { limit: 100 });
    expect(exec.query.mock.calls[0][0]).toMatch(/tenant_id=\$1 AND job_id=\$2/);
    expect(exec.query.mock.calls[0][0]).not.toMatch(/OFFSET/i);
  });
});
