// apps/stream-processor/src/processing/retry-policy.ts · PURE retry/DLQ decision. A consumer's handler can fail
// for two reasons: TRANSIENT (downstream blip — retry with backoff) or PERMANENT (malformed/poison — straight
// to DLQ, don't waste attempts). After maxAttempts of transient failure we give up to the DLQ so one poison
// message can't block a partition forever (head-of-line blocking is the classic stream killer).

export type FailureClass = 'transient' | 'permanent';

export interface RetryConfig { maxAttempts: number; baseMs: number; maxMs: number; }
export const DEFAULT_RETRY: RetryConfig = { maxAttempts: 5, baseMs: 200, maxMs: 30_000 };

export type RetryDecision =
  | { action: 'retry'; delayMs: number }
  | { action: 'dead_letter'; reason: 'permanent' | 'exhausted' };

/** Decide what to do after attempt #`attempt` (1-based) failed with `failure`. */
export function decideRetry(attempt: number, failure: FailureClass, cfg: RetryConfig = DEFAULT_RETRY): RetryDecision {
  if (failure === 'permanent') return { action: 'dead_letter', reason: 'permanent' };
  if (attempt >= cfg.maxAttempts) return { action: 'dead_letter', reason: 'exhausted' };
  return { action: 'retry', delayMs: backoffMs(attempt, cfg) };
}

/** Exponential backoff with full jitter, capped at maxMs. Jitter avoids a thundering-herd retry storm. */
export function backoffMs(attempt: number, cfg: RetryConfig = DEFAULT_RETRY, rand: () => number = Math.random): number {
  const exp = Math.min(cfg.maxMs, cfg.baseMs * 2 ** Math.max(0, attempt - 1));
  return Math.floor(rand() * exp);   // full jitter in [0, exp)
}

/** Classify a thrown error. Anything explicitly tagged permanent (bad data) → DLQ; everything else is treated
 *  as transient (network/timeout/5xx) and retried. Fail toward retry so we don't drop recoverable work. */
export function classify(err: unknown): FailureClass {
  const code = (err as { code?: unknown })?.code;
  const permanent = (err as { permanent?: unknown })?.permanent;
  if (permanent === true) return 'permanent';
  if (typeof code === 'string' && /^(BAD_EVENT|VALIDATION|UNSUPPORTED|PERMANENT)/.test(code)) return 'permanent';
  return 'transient';
}

/** A permanent (poison) error a handler can throw to skip retries and go straight to the DLQ. */
export class PoisonMessageError extends Error {
  readonly permanent = true;
  readonly code: string;
  constructor(code: string, message: string) { super(message); this.code = code; this.name = 'PoisonMessageError'; }
}
