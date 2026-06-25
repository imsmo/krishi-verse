// core/observability/__tests__/metrics.prom.spec.ts
// The /metrics exposition must be valid Prometheus text: metric names sanitised (no dots), # TYPE lines present,
// summaries carry quantiles + _count/_sum, and labels are preserved + escaped. A scrape parser would reject dots.
import { PromMetrics } from '../metrics.prom';

const VALID_NAME = /^[a-zA-Z_:][a-zA-Z0-9_:]*$/;

describe('PromMetrics.render — valid Prometheus exposition', () => {
  it('sanitises dotted names to underscores in counters', () => {
    const m = new PromMetrics();
    m.inc('payments.webhook', { provider: 'razorpay', kind: 'payment_captured' });
    const out = m.render();
    expect(out).toContain('# TYPE payments_webhook counter');
    expect(out).toMatch(/payments_webhook\{kind="payment_captured",provider="razorpay"\} 1/);
    expect(out).not.toContain('payments.webhook'); // no dotted name leaks
  });

  it('emits a summary (quantiles + _count + _sum) for observed timings, names sanitised', () => {
    const m = new PromMetrics();
    for (const v of [10, 20, 30, 40]) m.observe('auth.request_otp', v, { ok: 'true' });
    const out = m.render();
    expect(out).toContain('# TYPE auth_request_otp summary');
    expect(out).toMatch(/auth_request_otp\{ok="true",quantile="0.5"\}/);
    expect(out).toMatch(/auth_request_otp\{ok="true",quantile="0.99"\}/);
    expect(out).toMatch(/auth_request_otp_count\{ok="true"\} 4/);
    expect(out).toMatch(/auth_request_otp_sum\{ok="true"\} 100/);
    expect(out).not.toContain('auth.request_otp');
  });

  it('every emitted series name (sans labels) is a valid Prometheus identifier', () => {
    const m = new PromMetrics();
    m.inc('dep.failure', { dep: 'razorpay', state: 'open' });
    m.observe('dep.call', 12, { dep: 'wallet', ok: 'false' });
    m.observe('payments.webhook', 5, {});
    const names = m.render().split('\n')
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => l.split(/[\s{]/)[0]);
    for (const n of names) expect(n).toMatch(VALID_NAME);
  });

  it('escapes quotes/backslashes/newlines in label values', () => {
    const m = new PromMetrics();
    m.inc('test.metric', { note: 'a"b\\c' });
    const out = m.render();
    expect(out).toContain('note="a\\"b\\\\c"');
  });
});
