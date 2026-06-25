// apps/worker/src/__tests__/scheduler.spec.ts · pure scheduler core: cron due-logic, deterministic lock keys,
// and the runner's orchestration (due/skip/lock-miss/failure-isolation). No DB — effects are injected.
import { isDue, nextRunMs, JobSpec } from '../runtime/cron';
import { lockKey } from '../runtime/leader-lock';
import { tick, RunnerEffects } from '../runtime/runner';

describe('cron.isDue', () => {
  it('is due when never run', () => expect(isDue(null, 1000, 60)).toBe(true));
  it('is not due before the interval elapses', () => expect(isDue(1000, 1000 + 59_000, 60)).toBe(false));
  it('is due once the interval elapses', () => expect(isDue(1000, 1000 + 60_000, 60)).toBe(true));
  it('nextRunMs adds the interval', () => expect(nextRunMs(1000, 60)).toBe(61_000));
});

describe('leader-lock.lockKey', () => {
  it('is deterministic + within int4 advisory range', () => {
    const k = lockKey('recon-zero-sum');
    expect(k).toBe(lockKey('recon-zero-sum'));
    expect(k).toBeGreaterThanOrEqual(0);
    expect(k).toBeLessThan(0x7fffffff);
  });
  it('distinct names → distinct keys (no obvious collision)', () => {
    const names = ['recon-zero-sum', 'ensure-partitions', 'retention-enforcer', 'idempotency-purge', 'dpdp-erasure', 'outbox-gauge'];
    expect(new Set(names.map(lockKey)).size).toBe(names.length);
  });
});

describe('runner.tick', () => {
  const jobs: JobSpec[] = [{ name: 'a', intervalSec: 60 }, { name: 'b', intervalSec: 60 }];
  function fx(over: Partial<RunnerEffects> = {}, ran: string[] = [], recs: Array<[string, boolean]> = []): RunnerEffects {
    return {
      now: () => 1_000_000,
      withLock: async (_k, fn) => { await fn(); return true; },
      run: async (n) => { ran.push(n); },
      record: (n, _ms, ok) => { recs.push([n, ok]); },
      log: () => {},
      ...over,
    };
  }

  it('runs all due jobs and records success', async () => {
    const ran: string[] = []; const recs: Array<[string, boolean]> = [];
    await tick(jobs, new Map(), fx({}, ran, recs));
    expect(ran.sort()).toEqual(['a', 'b']);
    expect(recs.every(([, ok]) => ok)).toBe(true);
  });

  it('skips not-due jobs', async () => {
    const ran: string[] = [];
    const last = new Map([['a', 1_000_000], ['b', 1_000_000]]); // just ran "now"
    await tick(jobs, last, fx({}, ran));
    expect(ran).toEqual([]);
  });

  it('isolates a failing job (the other still runs + is recorded failed)', async () => {
    const ran: string[] = []; const recs: Array<[string, boolean]> = [];
    await tick(jobs, new Map(), fx({ run: async (n) => { ran.push(n); if (n === 'a') throw new Error('boom'); } }, ran, recs));
    expect(ran.sort()).toEqual(['a', 'b']);
    expect(recs.find(([n]) => n === 'a')![1]).toBe(false);
    expect(recs.find(([n]) => n === 'b')![1]).toBe(true);
  });

  it('skips when another replica holds the lock (withLock=false) but still backs off', async () => {
    const ran: string[] = []; const last = new Map<string, number>();
    await tick(jobs, last, fx({ withLock: async () => false }, ran));
    expect(ran).toEqual([]);          // never ran (we didn't hold the lock)
    expect(last.get('a')).toBe(1_000_000); // but marked attempted → backs off
  });
});
