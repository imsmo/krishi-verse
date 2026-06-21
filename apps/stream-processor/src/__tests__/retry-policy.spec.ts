import { decideRetry, backoffMs, classify, PoisonMessageError, DEFAULT_RETRY } from '../processing/retry-policy';

describe('decideRetry', () => {
  it('retries transient failures with backoff until maxAttempts, then dead-letters (exhausted)', () => {
    const cfg = { maxAttempts: 3, baseMs: 100, maxMs: 1000 };
    expect(decideRetry(1, 'transient', cfg).action).toBe('retry');
    expect(decideRetry(2, 'transient', cfg).action).toBe('retry');
    expect(decideRetry(3, 'transient', cfg)).toEqual({ action: 'dead_letter', reason: 'exhausted' });
  });
  it('dead-letters a permanent failure immediately (no wasted attempts)', () => {
    expect(decideRetry(1, 'permanent')).toEqual({ action: 'dead_letter', reason: 'permanent' });
  });
});

describe('backoffMs', () => {
  it('grows exponentially, is capped, and is jittered within [0, exp)', () => {
    const cfg = { maxAttempts: 10, baseMs: 100, maxMs: 1000 };
    expect(backoffMs(1, cfg, () => 0.999)).toBeLessThan(100);
    expect(backoffMs(3, cfg, () => 0.999)).toBeLessThan(400);
    expect(backoffMs(50, cfg, () => 0.999)).toBeLessThan(1000);   // capped at maxMs
    expect(backoffMs(1, cfg, () => 0)).toBe(0);                   // full jitter floor
  });
});

describe('classify', () => {
  it('treats tagged poison errors as permanent, everything else transient (fail toward retry)', () => {
    expect(classify(new PoisonMessageError('BAD_EVENT', 'x'))).toBe('permanent');
    expect(classify({ code: 'VALIDATION_FAILED' })).toBe('permanent');
    expect(classify({ permanent: true })).toBe('permanent');
    expect(classify(new Error('ECONNRESET'))).toBe('transient');
    expect(classify({ code: 'ETIMEDOUT' })).toBe('transient');
  });
});

describe('DEFAULT_RETRY', () => {
  it('has sane bounds', () => {
    expect(DEFAULT_RETRY.maxAttempts).toBeGreaterThan(0);
    expect(decideRetry(DEFAULT_RETRY.maxAttempts, 'transient').action).toBe('dead_letter');
  });
});
