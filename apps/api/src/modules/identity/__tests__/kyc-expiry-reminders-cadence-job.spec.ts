// modules/identity/__tests__/kyc-expiry-reminders-cadence-job.spec.ts · the ScheduledJob wrapper that
// wires the (previously-unwired) KycExpiryRemindersJob into core/jobs/jobs.runner.ts on a nightly
// cadence. Proves the cross-tenant driver loop (list live tenants → runForTenant per tenant, isolating
// one tenant's failure), not the underlying per-tenant reminder logic (see kyc-expiry-reminders.job.ts's
// own coverage — via the identity bank-KYC gate specs — for that).
import { KycExpiryRemindersCadenceJob } from '../jobs/kyc-expiry-reminders.cadence-job';

describe('KycExpiryRemindersCadenceJob', () => {
  it('exposes its configured name + interval (ScheduledJob contract)', () => {
    const job = new KycExpiryRemindersCadenceJob(86_400_000, {} as any);
    expect(job.name).toBe('kyc-expiry-reminders');
    expect(job.intervalMs).toBe(86_400_000);
  });

  it('drives runForTenant once per live tenant returned by the cross-tenant tenant list query', async () => {
    const inner: any = { runForTenant: jest.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(0) };
    const pool = { query: jest.fn().mockResolvedValue({ rows: [{ id: 't1' }, { id: 't2' }] }) } as any;

    const job = new KycExpiryRemindersCadenceJob(86_400_000, inner);
    await expect(job.run(pool)).resolves.toBeUndefined();

    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('FROM tenants'));
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("'trial','active','grace'"));
    expect(inner.runForTenant).toHaveBeenCalledTimes(2);
    expect(inner.runForTenant).toHaveBeenNthCalledWith(1, 't1', 30);
    expect(inner.runForTenant).toHaveBeenNthCalledWith(2, 't2', 30);
  });

  it('isolates one tenant failing from the rest of the cycle (never throws)', async () => {
    const inner: any = {
      runForTenant: jest.fn()
        .mockRejectedValueOnce(new Error('tenant t1 boom'))
        .mockResolvedValueOnce(3),
    };
    const pool = { query: jest.fn().mockResolvedValue({ rows: [{ id: 't1' }, { id: 't2' }] }) } as any;

    const job = new KycExpiryRemindersCadenceJob(86_400_000, inner);
    await expect(job.run(pool)).resolves.toBeUndefined();

    expect(inner.runForTenant).toHaveBeenCalledTimes(2);
    expect(inner.runForTenant).toHaveBeenNthCalledWith(2, 't2', 30);
  });

  it('runs cleanly with zero live tenants', async () => {
    const inner: any = { runForTenant: jest.fn() };
    const pool = { query: jest.fn().mockResolvedValue({ rows: [] }) } as any;

    const job = new KycExpiryRemindersCadenceJob(86_400_000, inner);
    await expect(job.run(pool)).resolves.toBeUndefined();
    expect(inner.runForTenant).not.toHaveBeenCalled();
  });

  it('honours a custom reminder window when supplied', async () => {
    const inner: any = { runForTenant: jest.fn().mockResolvedValue(0) };
    const pool = { query: jest.fn().mockResolvedValue({ rows: [{ id: 't1' }] }) } as any;

    const job = new KycExpiryRemindersCadenceJob(86_400_000, inner, 45);
    await job.run(pool);

    expect(inner.runForTenant).toHaveBeenCalledWith('t1', 45);
  });
});
