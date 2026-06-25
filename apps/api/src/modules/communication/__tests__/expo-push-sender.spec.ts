// modules/communication/__tests__/expo-push-sender.spec.ts · the Expo push adapter (pure parse + degrade).
// A fake ResilienceService runs the fn and applies the fallback on throw (mirrors core/resilience contract),
// and a fake fetch returns canned Expo ticket payloads — no network. Proves: tickets→sent count, batching of
// >100 tokens, DeviceNotRegistered→invalidTokens, and degrade (5xx → fallback {sent:0}, never throws).
import { ExpoPushSender } from '../gateway/expo-push.sender';

const fakeResilience = () => ({
  run: async <T>(_dep: string, fn: () => Promise<T>, opts?: { fallback?: () => T }) => {
    try { return await fn(); } catch (e) { if (opts?.fallback) return opts.fallback(); throw e; }
  },
}) as any;

function fakeFetch(handler: (url: string, init: any) => { status?: number; body?: unknown }) {
  const calls: Array<{ url: string; body: any }> = [];
  (global as any).fetch = async (url: any, init: any) => {
    const r = handler(String(url), init); const status = r.status ?? 200;
    calls.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null });
    return { ok: status >= 200 && status < 300, status, json: async () => r.body ?? {} } as any;
  };
  return calls;
}

afterEach(() => { delete (global as any).fetch; });

describe('ExpoPushSender', () => {
  const cfg = { baseUrl: 'https://exp.host', accessToken: null };

  it('counts ok tickets as sent and posts to the Expo push URL', async () => {
    const calls = fakeFetch(() => ({ body: { data: [{ status: 'ok' }, { status: 'ok' }] } }));
    const s = new ExpoPushSender(cfg, fakeResilience());
    const res = await s.send({ idempotencyKey: 'n1', tokens: ['ExpoTok[a]', 'ExpoTok[b]'], title: 'Hi', body: 'Body' });
    expect(res.sent).toBe(2);
    expect(res.invalidTokens).toEqual([]);
    expect(calls[0].url).toBe('https://exp.host/--/api/v2/push/send');
    expect(calls[0].body).toHaveLength(2);
  });

  it('surfaces DeviceNotRegistered tokens as invalidTokens (for pruning)', async () => {
    fakeFetch(() => ({ body: { data: [{ status: 'ok' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }] } }));
    const s = new ExpoPushSender(cfg, fakeResilience());
    const res = await s.send({ idempotencyKey: 'n1', tokens: ['good', 'dead'], title: null, body: 'b' });
    expect(res.sent).toBe(1);
    expect(res.invalidTokens).toEqual(['dead']);
  });

  it('batches >100 tokens into multiple requests', async () => {
    const calls = fakeFetch(() => ({ body: { data: [] } }));   // empty tickets → whole batch treated accepted
    const s = new ExpoPushSender(cfg, fakeResilience());
    const tokens = Array.from({ length: 250 }, (_, i) => `t${i}`);
    const res = await s.send({ idempotencyKey: 'n1', tokens, title: null, body: 'b' });
    expect(calls).toHaveLength(3);          // 100 + 100 + 50
    expect(res.sent).toBe(250);
  });

  it('degrades to {sent:0} (never throws) when Expo is down', async () => {
    fakeFetch(() => ({ status: 503, body: {} }));
    const s = new ExpoPushSender(cfg, fakeResilience());
    const res = await s.send({ idempotencyKey: 'n1', tokens: ['t'], title: null, body: 'b' });
    expect(res.sent).toBe(0);
    expect(res.failureReason).toBe('push_unavailable');
  });

  it('returns no_tokens for an empty token list (no request)', async () => {
    const calls = fakeFetch(() => ({ body: {} }));
    const s = new ExpoPushSender(cfg, fakeResilience());
    const res = await s.send({ idempotencyKey: 'n1', tokens: [], title: null, body: 'b' });
    expect(res).toEqual({ sent: 0, invalidTokens: [], failureReason: 'no_tokens' });
    expect(calls).toHaveLength(0);
  });
});
