// modules/payments/__tests__/settlement-statements-job.spec.ts · unit tests for the previously-UNWIRED
// SettlementStatementsJob (KV-BL-P0-9-follow-on wires it into core/jobs/jobs.runner.ts via
// settlement-statements.cadence-job.ts). No real Postgres — the cross-tenant scan connection and the
// per-seller repo/service are mocked; SettlementStatementService.generate's own tx/idempotency logic is
// proven separately by billing-documents.integration.spec.ts.
import { SettlementStatementsJob } from '../jobs/settlement-statements.job';

function fakeClient() { return { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }), release: jest.fn() }; }
function fakePool(client: ReturnType<typeof fakeClient>) { return { connect: jest.fn().mockResolvedValue(client) } as any; }

describe('SettlementStatementsJob.run', () => {
  it('generates one statement per (tenant, seller) with open lines and counts them', async () => {
    const client = fakeClient();
    const pool = fakePool(client);
    const lines: any = {
      findSellersWithOpenLines: jest.fn().mockResolvedValue([
        { tenantId: 't1', sellerUserId: 's1' },
        { tenantId: 't1', sellerUserId: 's2' },
        { tenantId: 't2', sellerUserId: 's3' },
      ]),
    };
    const statements: any = {
      generate: jest.fn()
        .mockResolvedValueOnce(row('s1', '1000', '100', '50'))
        .mockResolvedValueOnce(row('s2', '2000', '200', '100'))
        .mockResolvedValueOnce(row('s3', '3000', '300', '150')),
    };

    const job = new SettlementStatementsJob(pool, lines, statements);
    const result = await job.run('2026-07-09', '2026-07-10');

    expect(result).toEqual({ generated: 3, skipped: 0, failed: 0 });
    expect(statements.generate).toHaveBeenCalledTimes(3);
    expect(statements.generate).toHaveBeenNthCalledWith(1, 't1', 's1', '2026-07-09', '2026-07-10', 'system', null);
    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('isolates a failing seller: the others still generate, the failure is counted (not thrown)', async () => {
    const pool = fakePool(fakeClient());
    const lines: any = { findSellersWithOpenLines: jest.fn().mockResolvedValue([{ tenantId: 't1', sellerUserId: 's1' }, { tenantId: 't1', sellerUserId: 's2' }]) };
    const statements: any = {
      generate: jest.fn()
        .mockRejectedValueOnce(new Error('no open lines'))
        .mockResolvedValueOnce(row('s2', '500', '50', '25')),
    };

    const job = new SettlementStatementsJob(pool, lines, statements);
    const result = await job.run('2026-07-09', '2026-07-10');

    expect(result).toEqual({ generated: 1, skipped: 0, failed: 1 });
  });

  it('a generated row that fails the zero-sum invariant is counted as failed, not generated', async () => {
    const pool = fakePool(fakeClient());
    const lines: any = { findSellersWithOpenLines: jest.fn().mockResolvedValue([{ tenantId: 't1', sellerUserId: 's1' }]) };
    // netMinor deliberately inconsistent with gross - commission - tax (1000-100-50=850, not 999)
    const statements: any = { generate: jest.fn().mockResolvedValue(row('s1', '1000', '100', '50', '999')) };

    const job = new SettlementStatementsJob(pool, lines, statements);
    const result = await job.run('2026-07-09', '2026-07-10');

    expect(result).toEqual({ generated: 0, skipped: 0, failed: 1 });
  });

  it('an empty cycle (no sellers with open lines) is a quiet no-op', async () => {
    const client = fakeClient();
    const pool = fakePool(client);
    const lines: any = { findSellersWithOpenLines: jest.fn().mockResolvedValue([]) };
    const statements: any = { generate: jest.fn() };

    const job = new SettlementStatementsJob(pool, lines, statements);
    const result = await job.run('2026-07-09', '2026-07-10');

    expect(result).toEqual({ generated: 0, skipped: 0, failed: 0 });
    expect(statements.generate).not.toHaveBeenCalled();
  });

  it('rolls back + releases the client if the cross-tenant scan itself throws', async () => {
    const client = fakeClient();
    const pool = fakePool(client);
    const lines: any = { findSellersWithOpenLines: jest.fn().mockRejectedValue(new Error('scan failed')) };
    const statements: any = { generate: jest.fn() };

    const job = new SettlementStatementsJob(pool, lines, statements);
    await expect(job.run('2026-07-09', '2026-07-10')).rejects.toThrow('scan failed');

    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});

function row(sellerUserId: string, gross: string, commission: string, tax: string, netOverride?: string) {
  const net = netOverride ?? String(BigInt(gross) - BigInt(commission) - BigInt(tax));
  return { id: `stmt-${sellerUserId}`, statementNo: `2026-07-${sellerUserId}`, sellerUserId, periodStart: '2026-07-09', periodEnd: '2026-07-10',
    grossMinor: gross, commissionMinor: commission, taxMinor: tax, netMinor: net, pdfMediaId: null, createdAt: new Date() };
}
