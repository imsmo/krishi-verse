// core/resilience/__tests__/resilience.spec.ts · primitives + composed executor (Law 12).
import { CircuitBreaker } from '../circuit-breaker';
import { Bulkhead } from '../bulkhead';
import { withTimeout } from '../timeout';
import { withRetry } from '../retry';
import { ResilienceService } from '../resilience.service';
import { TimeoutError, CircuitOpenError, BulkheadFullError } from '../resilience.errors';
import { InfraError } from '../../../shared/errors/app-error';

const noMetrics = { inc: jest.fn(), observe: jest.fn() } as any;
const infra = () => new InfraError('X', 'boom');           // retryable=true

describe('withTimeout', () => {
  it('rejects after the deadline', async () => {
    await expect(withTimeout('dep', 10, () => new Promise((r) => setTimeout(r, 100)))).rejects.toBeInstanceOf(TimeoutError);
  });
  it('passes through a fast success', async () => {
    await expect(withTimeout('dep', 50, async () => 'ok')).resolves.toBe('ok');
  });
});

describe('withRetry', () => {
  it('retries retryable errors up to the limit then succeeds', async () => {
    let n = 0;
    const r = await withRetry(async () => { if (++n < 3) throw infra(); return n; }, { retries: 3, baseMs: 1, maxMs: 1, sleep: async () => {} });
    expect(r).toBe(3);
  });
  it('does not retry a non-retryable error', async () => {
    let n = 0;
    await expect(withRetry(async () => { n++; throw new Error('plain'); }, { retries: 5, baseMs: 1, maxMs: 1, sleep: async () => {} })).rejects.toThrow('plain');
    expect(n).toBe(1);
  });
});

describe('CircuitBreaker', () => {
  it('opens after threshold failures and fails fast, then half-opens after reset', async () => {
    let clock = 0;
    const cb = new CircuitBreaker('dep', { failureThreshold: 2, resetMs: 100, halfOpenMax: 1, now: () => clock });
    await expect(cb.exec(async () => { throw infra(); })).rejects.toBeInstanceOf(InfraError);
    await expect(cb.exec(async () => { throw infra(); })).rejects.toBeInstanceOf(InfraError);
    expect(cb.currentState).toBe('open');
    await expect(cb.exec(async () => 'no')).rejects.toBeInstanceOf(CircuitOpenError); // fail fast
    clock = 200;                                   // past reset window
    await expect(cb.exec(async () => 'ok')).resolves.toBe('ok'); // half-open trial succeeds → closed
    expect(cb.currentState).toBe('closed');
  });
});

describe('Bulkhead', () => {
  it('rejects when concurrency + queue are saturated', async () => {
    const bh = new Bulkhead('dep', { maxConcurrent: 1, maxQueue: 0 });
    let release!: () => void;
    const hold = bh.exec(() => new Promise<void>((r) => { release = r; }));   // occupies the one slot
    await expect(bh.exec(async () => 'queued')).rejects.toBeInstanceOf(BulkheadFullError);
    release(); await hold;
  });
});

describe('ResilienceService', () => {
  it('forbids a fallback on a money call', async () => {
    const svc = new ResilienceService(noMetrics);
    await expect(svc.run('wallet', async () => 1, { money: true, fallback: async () => 0 })).rejects.toThrow(/must not have a fallback/);
  });
  it('does NOT retry a money call by default (retries=0)', async () => {
    const svc = new ResilienceService(noMetrics);
    let n = 0;
    await expect(svc.run('wallet', async () => { n++; throw infra(); }, { money: true })).rejects.toBeInstanceOf(InfraError);
    expect(n).toBe(1);
  });
  it('degrades to the fallback when the call fails (non-money)', async () => {
    const svc = new ResilienceService(noMetrics);
    svc.configure('search', { retries: 0, timeoutMs: 1000 });
    const r = await svc.run('search', async () => { throw infra(); }, { fallback: async () => 'from-db' });
    expect(r).toBe('from-db');
  });
});
