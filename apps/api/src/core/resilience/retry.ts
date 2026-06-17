// core/resilience/retry.ts · exponential backoff + full jitter. IDEMPOTENT operations only —
// the caller asserts the call is safe to repeat (e.g. a GET, or a write carrying an idempotency
// key). Never retry a non-idempotent money mutation without an idempotency key.
export interface RetryOptions {
  retries: number;            // max additional attempts after the first
  baseMs: number;             // first backoff
  maxMs: number;              // cap per-attempt backoff
  /** Only retry when this returns true (default: retry InfraError / flagged-retryable errors). */
  retryable?: (err: unknown) => boolean;
  /** Injectable sleep (tests pass a no-op). */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const defaultRetryable = (err: unknown) => (err as { retryable?: boolean })?.retryable === true;

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  const retryable = opts.retryable ?? defaultRetryable;
  const sleep = opts.sleep ?? defaultSleep;
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= opts.retries || !retryable(err)) throw err;
      const exp = Math.min(opts.maxMs, opts.baseMs * 2 ** attempt);
      const jittered = Math.floor(Math.random() * exp);   // full jitter (AWS) — avoids thundering herd
      attempt++;
      await sleep(jittered);
    }
  }
}
