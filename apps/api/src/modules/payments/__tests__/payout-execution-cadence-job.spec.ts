// modules/payments/__tests__/payout-execution-cadence-job.spec.ts · S5 review P0 — the ScheduledJob
// wrapper that wires the (previously-unwired) PayoutExecutionJob into core/jobs/jobs.runner.ts on a
// frequent cadence. Proves the contract + configured batch-size delegation + per-payout error isolation
// (mirroring settlement-statements-cadence-job.spec.ts's pattern), not the underlying claim/disburse SQL
// (see payout-execution.integration.spec.ts for that, against a live Postgres).
import { PayoutExecutionCadenceJob } from '../jobs/payout-execution.cadence-job';

describe('PayoutExecutionCadenceJob', () => {
  it('exposes its configured name + interval (ScheduledJob contract)', () => {
    const job = new PayoutExecutionCadenceJob(300_000, {} as any, {} as any);
    expect(job.name).toBe('payout-execution');
    expect(job.intervalMs).toBe(300_000);
  });

  it('defaults its batch size to 100 when not supplied', () => {
    const job: any = new PayoutExecutionCadenceJob(300_000, {} as any, {} as any);
    expect(job['batchSize']).toBe(100);
  });

  it('claims a batch (bounded by the configured batch size) then disburses each claimed payout', async () => {
    const claimed = [{ id: 'p1', tenantId: 't1' }, { id: 'p2', tenantId: 't1' }];
    const repo: any = { claimQueued: jest.fn().mockResolvedValue(claimed) };
    const payouts: any = { execute: jest.fn().mockResolvedValue({ status: 'success' }) };
    const client = { query: jest.fn(), release: jest.fn() };
    const pool = { connect: jest.fn().mockResolvedValue(client) } as any;

    const job = new PayoutExecutionCadenceJob(300_000, repo, payouts, 25);
    await expect(job.run(pool)).resolves.toBeUndefined();

    expect(repo.claimQueued).toHaveBeenCalledWith(expect.anything(), 25); // batch size flows through
    expect(payouts.execute).toHaveBeenCalledTimes(2);
    expect(payouts.execute).toHaveBeenNthCalledWith(1, 't1', 'p1');
    expect(payouts.execute).toHaveBeenNthCalledWith(2, 't1', 'p2');
    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  it('CRITICAL SAFETY: isolates one failing payout from the rest of the batch — never batch-aborts', async () => {
    const claimed = [{ id: 'p1', tenantId: 't1' }, { id: 'p2', tenantId: 't1' }, { id: 'p3', tenantId: 't1' }];
    const repo: any = { claimQueued: jest.fn().mockResolvedValue(claimed) };
    const payouts: any = {
      execute: jest.fn()
        .mockResolvedValueOnce({ status: 'success' })
        .mockRejectedValueOnce(new Error('ambiguous gateway timeout'))
        .mockResolvedValueOnce({ status: 'success' }),
    };
    const client = { query: jest.fn(), release: jest.fn() };
    const pool = { connect: jest.fn().mockResolvedValue(client) } as any;

    const job = new PayoutExecutionCadenceJob(300_000, repo, payouts);
    await expect(job.run(pool)).resolves.toBeUndefined(); // must not throw despite p2 rejecting

    // the loop must continue past the failing payout and still attempt p3
    expect(payouts.execute).toHaveBeenCalledTimes(3);
    expect(payouts.execute).toHaveBeenNthCalledWith(3, 't1', 'p3');
  });

  it('runs cleanly with zero claimed payouts', async () => {
    const repo: any = { claimQueued: jest.fn().mockResolvedValue([]) };
    const payouts: any = { execute: jest.fn() };
    const client = { query: jest.fn(), release: jest.fn() };
    const pool = { connect: jest.fn().mockResolvedValue(client) } as any;

    const job = new PayoutExecutionCadenceJob(300_000, repo, payouts);
    await expect(job.run(pool)).resolves.toBeUndefined();
    expect(payouts.execute).not.toHaveBeenCalled();
  });

  it('propagates a claim-step failure (rolls back + throws) so the runner logs a failed tick, rather than silently swallowing it', async () => {
    const repo: any = { claimQueued: jest.fn().mockRejectedValue(new Error('db down')) };
    const payouts: any = { execute: jest.fn() };
    const client = { query: jest.fn().mockResolvedValue({}), release: jest.fn() };
    const pool = { connect: jest.fn().mockResolvedValue(client) } as any;

    const job = new PayoutExecutionCadenceJob(300_000, repo, payouts);
    await expect(job.run(pool)).rejects.toThrow('db down');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(payouts.execute).not.toHaveBeenCalled();
  });
});
