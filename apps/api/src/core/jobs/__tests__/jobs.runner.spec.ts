// core/jobs/__tests__/jobs.runner.spec.ts · KV-BL-P0-9-follow-on — the in-process cadence-jobs runner.
// Follows the exact convention of core/outbox/__tests__/relay.runner.spec.ts: a real AppConfig built
// from minimal env (never mocked), and the runner's OWN scheduling/lock/lifecycle logic is exercised by
// injecting a fake pool/job rather than hitting a live Postgres — the job's own domain logic is tested
// separately (e.g. modules/payments/__tests__/settlement-statements-job.spec.ts).
import { AppConfig } from '../../config/app-config';
import { ScheduledJobsRunner } from '../jobs.runner';
import { ScheduledJobRegistry } from '../scheduled-job.registry';
import { ScheduledJob, lockKey } from '../scheduled-job';

let noMetrics: any;

function makeConfig(overrides: Record<string, string> = {}): AppConfig {
  return new AppConfig({
    NODE_ENV: 'development',
    DATABASE_URL: 'postgres://kv_relay:dev@localhost:5432/krishi_test',
    JWT_ACCESS_SECRET: 'unit-test-access-secret-min-32-chars',
    AUTH_HASH_PEPPER: 'unit-test-pepper-min-32-characters!',
    JOBS_POOL_MAX: '2',
    ...overrides,
  });
}

function fakeJob(over: Partial<ScheduledJob> = {}): ScheduledJob {
  return { name: 'test-job', intervalMs: 1000, run: jest.fn().mockResolvedValue(undefined), ...over };
}

/** Bypass onApplicationBootstrap()/`new Pool()` — inject a fake pool directly, matching how
 *  relay.runner.spec.ts injects a fake dispatcher. No network I/O in these tests. */
function withFakePool(runner: ScheduledJobsRunner, connect: jest.Mock) {
  (runner as any).pool = { connect };
}

function fakeClient(lockOk: boolean) {
  return { query: jest.fn().mockResolvedValue({ rows: [{ ok: lockOk }] }), release: jest.fn() };
}

describe('ScheduledJobsRunner.tick', () => {
  beforeEach(() => { noMetrics = { inc: jest.fn(), observe: jest.fn() }; });
  afterEach(() => { jest.useRealTimers(); });

  it('acquires the advisory lock (keyed by job name) and runs the job under it', async () => {
    const runner = new ScheduledJobsRunner(makeConfig(), new ScheduledJobRegistry(), noMetrics);
    const client = fakeClient(true);
    const connect = jest.fn().mockResolvedValue(client);
    withFakePool(runner, connect);
    const job = fakeJob();

    await runner.tick(job);

    expect(job.run).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenNthCalledWith(1, 'SELECT pg_try_advisory_lock($1) AS ok', [lockKey(job.name)]);
    expect(client.query).toHaveBeenNthCalledWith(2, 'SELECT pg_advisory_unlock($1)', [lockKey(job.name)]);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('lock NOT acquired (another pod holds it): the job never runs, connection still released', async () => {
    const runner = new ScheduledJobsRunner(makeConfig(), new ScheduledJobRegistry(), noMetrics);
    const client = fakeClient(false);
    withFakePool(runner, jest.fn().mockResolvedValue(client));
    const job = fakeJob();

    await runner.tick(job);

    expect(job.run).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalledTimes(1);
    // only the lock attempt query — no unlock (never acquired) and no job work
    expect(client.query).toHaveBeenCalledTimes(1);
  });

  it('a failing job is isolated: never throws, is metered + logged, and the lock is still released', async () => {
    const runner = new ScheduledJobsRunner(makeConfig(), new ScheduledJobRegistry(), noMetrics);
    const client = fakeClient(true);
    withFakePool(runner, jest.fn().mockResolvedValue(client));
    const job = fakeJob({ run: jest.fn().mockRejectedValue(new Error('boom')) });

    await expect(runner.tick(job)).resolves.toBeUndefined();

    expect(noMetrics.inc).toHaveBeenCalledWith('jobs.tick_failed', { job: job.name });
    expect(client.query).toHaveBeenNthCalledWith(2, 'SELECT pg_advisory_unlock($1)', [lockKey(job.name)]);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('a connection-acquire failure (pool down) never throws and is isolated per job', async () => {
    const runner = new ScheduledJobsRunner(makeConfig(), new ScheduledJobRegistry(), noMetrics);
    withFakePool(runner, jest.fn().mockRejectedValue(new Error('connection terminated')));
    const job = fakeJob();

    await expect(runner.tick(job)).resolves.toBeUndefined();

    expect(job.run).not.toHaveBeenCalled();
    expect(noMetrics.inc).toHaveBeenCalledWith('jobs.tick_connection_failed', { job: job.name });
  });

  it('overlapping-tick guard: a job already marked in-flight is skipped without ever connecting', async () => {
    const runner = new ScheduledJobsRunner(makeConfig(), new ScheduledJobRegistry(), noMetrics);
    // Simulates the state a real in-progress tick would have left behind — the guard is a plain
    // synchronous check at the top of tick(), so this is equivalent to (and far less timing-fragile
    // than) racing two real overlapping calls.
    (runner as any).state.set('test-job', { timer: null, inFlight: true });
    const connect = jest.fn();
    withFakePool(runner, connect);
    const job = fakeJob();

    await runner.tick(job);

    expect(connect).not.toHaveBeenCalled();
    expect(job.run).not.toHaveBeenCalled();
  });

  it('once the previous run has settled (inFlight cleared), the job ticks normally again', async () => {
    const runner = new ScheduledJobsRunner(makeConfig(), new ScheduledJobRegistry(), noMetrics);
    (runner as any).state.set('test-job', { timer: null, inFlight: false });
    const client = fakeClient(true);
    withFakePool(runner, jest.fn().mockResolvedValue(client));
    const job = fakeJob();

    await runner.tick(job);

    expect(job.run).toHaveBeenCalledTimes(1);
    expect((runner as any).state.get('test-job').inFlight).toBe(false); // cleared again after the run settles
  });

  it('two DIFFERENT jobs never block each other (independent locks + independent in-flight state)', async () => {
    const runner = new ScheduledJobsRunner(makeConfig(), new ScheduledJobRegistry(), noMetrics);
    const clientA = fakeClient(true);
    const clientB = fakeClient(true);
    const connect = jest.fn().mockResolvedValueOnce(clientA).mockResolvedValueOnce(clientB);
    withFakePool(runner, connect);
    const jobA = fakeJob({ name: 'job-a' });
    const jobB = fakeJob({ name: 'job-b' });

    await Promise.all([runner.tick(jobA), runner.tick(jobB)]);

    expect(jobA.run).toHaveBeenCalledTimes(1);
    expect(jobB.run).toHaveBeenCalledTimes(1);
    expect(lockKey('job-a')).not.toBe(lockKey('job-b'));
  });

  it('a stopped runner (post-shutdown) never ticks, even if called directly', async () => {
    const runner = new ScheduledJobsRunner(makeConfig(), new ScheduledJobRegistry(), noMetrics);
    (runner as any).pool = { connect: jest.fn(), end: jest.fn().mockResolvedValue(undefined) };
    await runner.onApplicationShutdown();
    const job = fakeJob();

    await runner.tick(job);

    expect(job.run).not.toHaveBeenCalled();
  });
});

describe('ScheduledJobsRunner.onApplicationBootstrap', () => {
  beforeEach(() => { noMetrics = { inc: jest.fn(), observe: jest.fn() }; });

  it('JOBS_ENABLED=false: never starts a pool or any job timer', () => {
    const runner = new ScheduledJobsRunner(makeConfig({ JOBS_ENABLED: 'false' }), new ScheduledJobRegistry(), noMetrics);
    runner.onApplicationBootstrap();
    expect((runner as any).pool).toBeNull();
    expect((runner as any).state.size).toBe(0);
  });

  it('NODE_ENV=test: never starts (specs drive jobs directly)', () => {
    const runner = new ScheduledJobsRunner(makeConfig({ NODE_ENV: 'test' }), new ScheduledJobRegistry(), noMetrics);
    runner.onApplicationBootstrap();
    expect((runner as any).pool).toBeNull();
  });

  it('no registered jobs: does not create a pool', () => {
    const runner = new ScheduledJobsRunner(makeConfig(), new ScheduledJobRegistry(), noMetrics);
    runner.onApplicationBootstrap();
    expect((runner as any).pool).toBeNull();
  });

  it('registered jobs: starts one timer per job (does not throw constructing the pool)', async () => {
    // Note: this exercises the REAL Pool construction path (as relay.runner.ts's equivalent test does
    // for OutboxRelayRunner) — the immediate drain-on-boot tick will attempt (and harmlessly fail) a
    // real connection to the bogus DATABASE_URL, caught internally by tick()'s own error isolation;
    // shutdown() below closes the pool so the test leaves no open handles.
    const registry = new ScheduledJobRegistry();
    registry.register(fakeJob({ name: 'a' }));
    registry.register(fakeJob({ name: 'b' }));
    const runner = new ScheduledJobsRunner(makeConfig(), registry, noMetrics);

    expect(() => runner.onApplicationBootstrap()).not.toThrow();

    expect((runner as any).pool).not.toBeNull();
    expect((runner as any).state.size).toBe(2);

    await runner.onApplicationShutdown();
  });
});

describe('ScheduledJobsRunner.onApplicationShutdown', () => {
  beforeEach(() => { noMetrics = { inc: jest.fn(), observe: jest.fn() }; });
  afterEach(() => { jest.useRealTimers(); });

  it('stops every job\'s timer and ends the pool', async () => {
    jest.useFakeTimers();
    const runner = new ScheduledJobsRunner(makeConfig(), new ScheduledJobRegistry(), noMetrics);
    const fakePool = { end: jest.fn().mockResolvedValue(undefined) };
    (runner as any).pool = fakePool;
    const timer = setInterval(() => {}, 1000);
    (runner as any).state.set('a', { timer, inFlight: false });

    await runner.onApplicationShutdown();

    expect((runner as any).state.size).toBe(0);
    expect(fakePool.end).toHaveBeenCalledTimes(1);
    expect((runner as any).pool).toBeNull();
  });
});
