// apps/worker/src/runtime/runner.ts · pure scheduler tick. Runs every DUE job under its leader-lock, times it,
// records metrics, and ISOLATES failures (one job throwing never blocks the others). Effects are injected, so
// this is fully unit-testable with no I/O.
import { JobSpec, isDue } from './cron';
import { lockKey } from './leader-lock';

export interface RunnerEffects {
  now(): number;
  withLock(key: number, fn: () => Promise<void>): Promise<boolean>; // false ⇒ lock not acquired (skipped)
  run(name: string): Promise<void>;
  record(name: string, ms: number, ok: boolean): void;
  log(level: 'info' | 'error', msg: string, meta?: Record<string, unknown>): void;
}

export async function tick(jobs: JobSpec[], lastRun: Map<string, number>, fx: RunnerEffects): Promise<void> {
  const now = fx.now();
  for (const job of jobs) {
    if (!isDue(lastRun.get(job.name) ?? null, now, job.intervalSec)) continue;
    const acquired = await fx.withLock(lockKey(job.name), async () => {
      const t0 = fx.now();
      try { await fx.run(job.name); fx.record(job.name, fx.now() - t0, true); }
      catch (err) { fx.record(job.name, fx.now() - t0, false); fx.log('error', `job ${job.name} failed`, { error: (err as Error).message }); }
    });
    lastRun.set(job.name, now); // attempted → back off until interval re-elapses (even if another replica held it)
    if (!acquired) fx.log('info', `job ${job.name} skipped (held by another replica)`);
  }
}
