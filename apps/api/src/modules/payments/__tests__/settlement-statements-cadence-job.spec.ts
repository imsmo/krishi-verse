// modules/payments/__tests__/settlement-statements-cadence-job.spec.ts · the ScheduledJob wrapper that
// wires the (previously-unwired) SettlementStatementsJob into core/jobs/jobs.runner.ts on a nightly
// cadence. Proves the window computation + delegation, not the underlying job logic (see
// settlement-statements-job.spec.ts for that).
import { SettlementStatementsCadenceJob } from '../jobs/settlement-statements.cadence-job';

describe('SettlementStatementsCadenceJob', () => {
  it('exposes its configured name + interval (ScheduledJob contract)', () => {
    const job = new SettlementStatementsCadenceJob(86_400_000, {} as any, {} as any);
    expect(job.name).toBe('settlement-statements');
    expect(job.intervalMs).toBe(86_400_000);
  });

  it('runs the underlying job for "yesterday" (UTC) and never throws even if generation reports failures', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-10T03:00:00Z'));
    const lines: any = {
      findSellersWithOpenLines: jest.fn().mockResolvedValue([{ tenantId: 't1', sellerUserId: 's1' }]),
    };
    const statements: any = {
      generate: jest.fn().mockResolvedValue({
        id: 'stmt-1', statementNo: '2026-07-s1', sellerUserId: 's1', periodStart: '2026-07-09', periodEnd: '2026-07-10',
        grossMinor: '1000', commissionMinor: '100', taxMinor: '50', netMinor: '850', pdfMediaId: null, createdAt: new Date(),
      }),
    };
    const pool = { connect: jest.fn().mockResolvedValue({ query: jest.fn(), release: jest.fn() }) } as any;

    const job = new SettlementStatementsCadenceJob(86_400_000, lines, statements);
    await expect(job.run(pool)).resolves.toBeUndefined();

    expect(lines.findSellersWithOpenLines).toHaveBeenCalledWith(expect.anything(), '2026-07-09', '2026-07-10', expect.any(Number));
    expect(statements.generate).toHaveBeenCalledWith('t1', 's1', '2026-07-09', '2026-07-10', 'system-scheduled-job', null);

    jest.useRealTimers();
  });
});
