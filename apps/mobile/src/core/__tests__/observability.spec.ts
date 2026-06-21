// Unit tests for the PURE observability logic (core/observability) shipped in P-31. No React/native deps. The
// headline invariant (DoD "no PII in any payload"): redactPII strips tokens/phone/Aadhaar/PAN/email/account from
// nested objects + free text. Also: the analytics buffer is bounded + consent-gated + scrubs props, SLO targets
// are well-formed, the crash sanitizer redacts, and the correlation header is a non-PII token.
import { redactPII, scrubString, REDACTED } from '../../core/observability/redact';
import { buildEvent, appendBounded, track, setAnalyticsConsent, bufferedCount, EVENTS, type AnalyticsEvent } from '../../core/observability/analytics';
import { sanitizeEvent } from '../../core/observability/crash';
import { meetsSlo, sloFor, SLOS } from '../../core/observability/slo';
import { correlationHeaders, rotateCorrelationId, currentCorrelationId } from '../../core/observability/correlation';

describe('redactPII — no PII leaves the device', () => {
  it('drops denylisted keys regardless of value', () => {
    const out = redactPII({ authorization: 'Bearer abc', token: 'x', otp: '123456', phone: '9812345678', accountNumber: '1234567890123', name: 'Ram' }) as Record<string, unknown>;
    expect(out.authorization).toBe(REDACTED);
    expect(out.token).toBe(REDACTED);
    expect(out.otp).toBe(REDACTED);
    expect(out.phone).toBe(REDACTED);
    expect(out.accountNumber).toBe(REDACTED);
    expect(out.name).toBe('Ram'); // non-sensitive key kept
  });
  it('masks PII patterns inside free strings', () => {
    expect(scrubString('call me on 9812345678')).not.toContain('9812345678');
    expect(scrubString('Authorization: Bearer eyJhbGci.payload.sig')).toContain(REDACTED);
    expect(scrubString('aadhaar 1234 5678 9012 here')).toContain(REDACTED);
    expect(scrubString('pan ABCDE1234F filed')).toContain(REDACTED);
    expect(scrubString('mail ram@example.com today')).toContain(REDACTED);
    expect(scrubString('card 4111111111111111')).toContain(REDACTED);
  });
  it('recurses nested structures + handles cycles/depth', () => {
    const out = redactPII({ user: { phone: '9812345678', notes: ['ok', { token: 'secret' }] } }) as any;
    expect(out.user.phone).toBe(REDACTED);
    expect(out.user.notes[1].token).toBe(REDACTED);
    const cyclic: any = { a: 1 }; cyclic.self = cyclic;
    expect(() => redactPII(cyclic)).not.toThrow();
  });
  it('never ships functions/symbols', () => {
    expect(redactPII((() => 1) as any)).toBe(REDACTED);
  });
});

describe('analytics funnels', () => {
  afterEach(() => setAnalyticsConsent(false));
  it('buildEvent scrubs props + tags correlation id + ts', () => {
    const ev = buildEvent(EVENTS.checkoutSuccess, { phone: '9812345678', items: 3 }, 1000);
    expect(ev.name).toBe('checkout.success');
    expect((ev.props as any).phone).toBe(REDACTED);
    expect((ev.props as any).items).toBe(3);
    expect(ev.ts).toBe(1000);
    expect(typeof ev.correlationId).toBe('string');
  });
  it('track is a no-op without consent, buffers once consented', () => {
    setAnalyticsConsent(false);
    track(EVENTS.loginSuccess);
    expect(bufferedCount()).toBe(0);
    setAnalyticsConsent(true);
    track(EVENTS.loginSuccess);
    expect(bufferedCount()).toBe(1);
  });
  it('appendBounded drops the oldest beyond the cap', () => {
    const mk = (n: number): AnalyticsEvent => ({ name: `e${n}`, props: {}, ts: n, correlationId: 'c' });
    let buf: AnalyticsEvent[] = [];
    for (let i = 0; i < 5; i++) buf = appendBounded(buf, mk(i), 3);
    expect(buf.map((e) => e.ts)).toEqual([2, 3, 4]);
  });
});

describe('crash sanitizer', () => {
  it('redacts message + context', () => {
    const s = sanitizeEvent({ message: 'failed for 9812345678', context: { token: 'x', ok: true } });
    expect(s.message).not.toContain('9812345678');
    expect((s.context as any).token).toBe(REDACTED);
    expect((s.context as any).ok).toBe(true);
  });
});

describe('SLO catalog', () => {
  it('crash-free target is ≥ 99.5% and meetsSlo compares correctly', () => {
    expect(sloFor('crash_free_sessions')!.target).toBe(0.995);
    expect(meetsSlo('crash_free_sessions', 0.996)).toBe(true);
    expect(meetsSlo('crash_free_sessions', 0.99)).toBe(false);
    expect(meetsSlo('unknown_metric', 1)).toBe(false); // fail-closed
    expect(SLOS.length).toBeGreaterThanOrEqual(4);
  });
});

describe('correlation id', () => {
  it('is a non-PII token surfaced in a header + rotatable', () => {
    const h = correlationHeaders();
    expect(typeof h['x-correlation-id']).toBe('string');
    expect(h['x-correlation-id'].length).toBeGreaterThan(0);
    const before = currentCorrelationId();
    const after = rotateCorrelationId();
    expect(after).not.toBe(before);
    expect(correlationHeaders()['x-correlation-id']).toBe(after);
  });
});
