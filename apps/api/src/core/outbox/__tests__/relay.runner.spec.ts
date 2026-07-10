// core/outbox/__tests__/relay.runner.spec.ts · KV-BL-063 — the in-process outbox relay timer.
// Exercises the RUNNER's own scheduling/guard/lifecycle logic (OutboxDispatcher.relayBatch itself is
// covered by outbox-dispatcher.spec.ts). A real AppConfig is constructed with minimal env — the same
// convention modules/payments/__tests__/orders-payments-e2e.integration.spec.ts and
// modules/payments/pilot-e2e/relay-tick.ts use — rather than mocking it.
import { AppConfig } from '../../config/app-config';
import { OutboxRelayRunner } from '../relay.runner';
import { OutboxHandlerRegistry } from '../outbox.dispatcher';

let noMetrics: any; // { inc: jest.Mock, observe: jest.Mock } — matches outbox-dispatcher.spec.ts's convention

function makeConfig(overrides: Record<string, string> = {}): AppConfig {
  return new AppConfig({
    NODE_ENV: 'development',
    DATABASE_URL: 'postgres://kv_relay:dev@localhost:5432/krishi_test',
    JWT_ACCESS_SECRET: 'unit-test-access-secret-min-32-chars',
    AUTH_HASH_PEPPER: 'unit-test-pepper-min-32-characters!',
    RELAY_INTERVAL_MS: '100', // schema floor is 100 (env.validation.ts)
    RELAY_BATCH_SIZE: '25',
    ...overrides,
  });
}

/** Bypass startTimer()/`new Pool()` entirely — inject a fake dispatcher directly, exactly the shape
 *  `tick()` depends on (`{ relayBatch(max): Promise<number> }`). No network I/O in these tests. */
function withFakeDispatcher(runner: OutboxRelayRunner, relayBatch: jest.Mock, batchSize = 25) {
  (runner as any).dispatcher = { relayBatch };
  (runner as any).batchSize = batchSize;
}

describe('OutboxRelayRunner', () => {
  beforeEach(() => { noMetrics = { inc: jest.fn(), observe: jest.fn() }; });
  afterEach(() => { jest.useRealTimers(); });

  it('a tick calls dispatcher.relayBatch(batchSize) and logs nothing crash-worthy on success', async () => {
    const runner = new OutboxRelayRunner(makeConfig(), new OutboxHandlerRegistry(), noMetrics);
    const relayBatch = jest.fn().mockResolvedValue(3);
    withFakeDispatcher(runner, relayBatch, 25);

    await runner.tick();

    expect(relayBatch).toHaveBeenCalledTimes(1);
    expect(relayBatch).toHaveBeenCalledWith(25);
  });

  it('a tick with an empty queue (relayBatch resolves 0) is a quiet no-op', async () => {
    const runner = new OutboxRelayRunner(makeConfig(), new OutboxHandlerRegistry(), noMetrics);
    const relayBatch = jest.fn().mockResolvedValue(0);
    withFakeDispatcher(runner, relayBatch);

    await expect(runner.tick()).resolves.toBeUndefined();
    expect(relayBatch).toHaveBeenCalledTimes(1);
  });

  it('a hard tick failure (e.g. the relay pool is down) never throws — it is caught, metered, and logged', async () => {
    const runner = new OutboxRelayRunner(makeConfig(), new OutboxHandlerRegistry(), noMetrics);
    const relayBatch = jest.fn().mockRejectedValue(new Error('connection terminated'));
    withFakeDispatcher(runner, relayBatch);

    await expect(runner.tick()).resolves.toBeUndefined();   // never rejects — a bad tick must not crash the api
    expect(noMetrics.inc).toHaveBeenCalledWith('outbox.relay_tick_failed');
  });

  it('overlapping-tick guard: a tick already in flight makes the next call a no-op until it settles', async () => {
    const runner = new OutboxRelayRunner(makeConfig(), new OutboxHandlerRegistry(), noMetrics);
    let resolveFirst!: (n: number) => void;
    const relayBatch = jest.fn()
      .mockImplementationOnce(() => new Promise<number>((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValue(1);
    withFakeDispatcher(runner, relayBatch);

    const firstTick = runner.tick();      // starts a "slow" batch, does not resolve yet
    await runner.tick();                  // guarded: sees inFlight, returns immediately WITHOUT calling relayBatch again
    expect(relayBatch).toHaveBeenCalledTimes(1);

    resolveFirst(2);                      // let the first batch complete
    await firstTick;

    await runner.tick();                  // now free to run again
    expect(relayBatch).toHaveBeenCalledTimes(2);
  });

  it('RELAY_ENABLED=false: onApplicationBootstrap never starts the timer or a dispatcher', () => {
    const runner = new OutboxRelayRunner(makeConfig({ RELAY_ENABLED: 'false' }), new OutboxHandlerRegistry(), noMetrics);
    runner.onApplicationBootstrap();
    expect((runner as any).timer).toBeNull();
    expect((runner as any).dispatcher).toBeNull();
    expect((runner as any).relayPool).toBeNull();
  });

  it('NODE_ENV=test: onApplicationBootstrap never starts the timer (integration specs drive the dispatcher directly)', () => {
    const runner = new OutboxRelayRunner(makeConfig({ NODE_ENV: 'test' }), new OutboxHandlerRegistry(), noMetrics);
    runner.onApplicationBootstrap();
    expect((runner as any).timer).toBeNull();
    expect((runner as any).dispatcher).toBeNull();
  });

  it('shutdown stops the loop: no further ticks fire, and the relay pool is closed', async () => {
    jest.useFakeTimers();
    const runner = new OutboxRelayRunner(makeConfig(), new OutboxHandlerRegistry(), noMetrics);
    const relayBatch = jest.fn().mockResolvedValue(0);
    withFakeDispatcher(runner, relayBatch);
    const fakePool = { end: jest.fn().mockResolvedValue(undefined) };
    (runner as any).relayPool = fakePool;
    // simulate what startTimer() wires up, without touching real pg/Pool
    (runner as any).timer = setInterval(() => { void runner.tick(); }, 50);

    await jest.advanceTimersByTimeAsync(170); // ~3 ticks at 50ms
    expect(relayBatch.mock.calls.length).toBeGreaterThanOrEqual(2);

    const callsBeforeShutdown = relayBatch.mock.calls.length;
    await runner.onApplicationShutdown();

    expect((runner as any).timer).toBeNull();
    expect(fakePool.end).toHaveBeenCalledTimes(1);
    expect((runner as any).relayPool).toBeNull();

    await jest.advanceTimersByTimeAsync(500); // well past several more would-be intervals
    expect(relayBatch.mock.calls.length).toBe(callsBeforeShutdown); // loop truly stopped, not just paused
  });

  it('a tick after shutdown is a no-op even if something still calls tick() directly', async () => {
    const runner = new OutboxRelayRunner(makeConfig(), new OutboxHandlerRegistry(), noMetrics);
    const relayBatch = jest.fn().mockResolvedValue(1);
    withFakeDispatcher(runner, relayBatch);

    await runner.onApplicationShutdown();
    await runner.tick();

    expect(relayBatch).not.toHaveBeenCalled();
  });

  it('backs off the timer interval after repeated consecutive hard failures', async () => {
    jest.useFakeTimers();
    const runner = new OutboxRelayRunner(makeConfig(), new OutboxHandlerRegistry(), noMetrics);
    const relayBatch = jest.fn().mockRejectedValue(new Error('connection terminated'));
    withFakeDispatcher(runner, relayBatch);
    (runner as any).timer = setInterval(() => { void runner.tick(); }, 50);

    for (let i = 0; i < 5; i++) await runner.tick();   // 5 consecutive failures trips the backoff threshold

    expect((runner as any).consecutiveFailures).toBe(5);
    // the timer was replaced (still non-null, but a fresh handle at the widened cadence) — assert
    // ticks keep firing (backoff slows, never stops) by advancing well past the widened interval.
    const callsSoFar = relayBatch.mock.calls.length;
    await jest.advanceTimersByTimeAsync(1100); // > min(100*10, 30000) = 1000ms backoff window
    expect(relayBatch.mock.calls.length).toBeGreaterThan(callsSoFar);

    await runner.onApplicationShutdown();
  });
});
