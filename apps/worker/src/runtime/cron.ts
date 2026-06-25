// apps/worker/src/runtime/cron.ts · pure interval scheduler (clock injected → unit-testable). A job runs when its
// interval has elapsed since its last attempt. Deterministic; finer cron expressions can layer on later.
export interface JobSpec { readonly name: string; readonly intervalSec: number }

export function isDue(lastRunMs: number | null, nowMs: number, intervalSec: number): boolean {
  if (lastRunMs === null) return true;
  return nowMs - lastRunMs >= intervalSec * 1000;
}
export function nextRunMs(lastRunMs: number | null, intervalSec: number): number {
  return (lastRunMs ?? 0) + intervalSec * 1000;
}
