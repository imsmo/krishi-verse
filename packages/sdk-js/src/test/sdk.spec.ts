// @krishi-verse/sdk-js · unit tests with an injected fake fetch (no network). Pins the contract every frontend
// relies on: URL/version building, header attachment (bearer/tenant/idempotency), {data,meta} envelope
// unwrap, typed error mapping (code/status/requestId), token NOT leaking into errors, idempotent-GET retry vs
// no-retry on mutations, timeout, and money staying a string.
import { createClient } from '../client';
import { SdkError, SdkTimeoutError } from '../errors';

type Call = { url: string; init: RequestInit };
function fakeFetch(handler: (call: Call, n: number) => { status?: number; body?: unknown; headers?: Record<string, string> }) {
  const calls: Call[] = [];
  const fn = (async (url: any, init: any) => {
    const call = { url: String(url), init: init ?? {} }; calls.push(call);
    const r = handler(call, calls.length);
    const status = r.status ?? 200;
    return {
      ok: status >= 200 && status < 300, status,
      headers: { get: (k: string) => (r.headers ?? {})[k.toLowerCase()] ?? null },
      text: async () => (r.body === undefined ? '' : JSON.stringify(r.body)),
    } as any;
  }) as unknown as typeof fetch;
  return { fn, calls };
}
const base = { baseUrl: 'https://api.test', fetchImpl: undefined as any };

describe('HttpClient via resources', () => {
  it('builds /v1 URL + query, unwraps {data,meta}, returns string money', async () => {
    const { fn, calls } = fakeFetch(() => ({ body: { data: [{ id: 'l1', title: 'Tomato', priceMinor: '999999999999', currencyCode: 'INR', unitCode: 'kg', quantityAvailable: 5, organicClaim: true, saleType: 'fixed', regionId: null, sellerUserId: 'u1', boosted: false }], meta: { nextCursor: 'c1' } } }));
    const c = createClient({ ...base, fetchImpl: fn });
    const page = await c.listings.browse({ q: 'tomato', limit: 10 });
    expect(calls[0].url).toBe('https://api.test/v1/listings?q=tomato&limit=10');
    expect(calls[0].init.method).toBe('GET');
    expect(page.items[0].priceMinor).toBe('999999999999');
    expect(typeof page.items[0].priceMinor).toBe('string');
    expect(page.nextCursor).toBe('c1');
  });

  it('attaches bearer + tenant + idempotency headers; never on anonymous calls', async () => {
    const { fn, calls } = fakeFetch(() => ({ body: { data: { requested: true } } }));
    const c = createClient({ ...base, fetchImpl: fn, tenantSlug: 'acme', getToken: () => 'tok-123' });
    await c.auth.requestOtp('+919812345678', 'idem-1');                 // anonymous → no bearer, but idempotency-key
    const h = calls[0].init.headers as Record<string, string>;
    expect(h.authorization).toBeUndefined();
    expect(h['idempotency-key']).toBe('idem-1');
    expect(h['x-tenant-slug']).toBe('acme');
    await c.auth.me();                                                   // authed → bearer present
    const h2 = calls[1].init.headers as Record<string, string>;
    expect(h2.authorization).toBe('Bearer tok-123');
  });

  it('maps a non-2xx to a typed SdkError (code/status/requestId) and never leaks the token', async () => {
    const { fn } = fakeFetch(() => ({ status: 409, body: { code: 'WALLET_INSUFFICIENT_BALANCE', message: 'no funds', requestId: 'req-9' } }));
    const c = createClient({ ...base, fetchImpl: fn, getToken: () => 'super-secret-token' });
    await expect(c.auth.me()).rejects.toMatchObject({ code: 'WALLET_INSUFFICIENT_BALANCE', status: 409, requestId: 'req-9' });
    try { await c.auth.me(); } catch (e) { expect(JSON.stringify(e)).not.toContain('super-secret-token'); expect(e).toBeInstanceOf(SdkError); }
  });

  it('retries an idempotent GET on 5xx, then succeeds', async () => {
    const { fn, calls } = fakeFetch((_c, n) => (n < 3 ? { status: 503, body: { code: 'X' } } : { body: { data: [], meta: {} } }));
    const c = createClient({ ...base, fetchImpl: fn, retries: 2 });
    const page = await c.listings.browse();
    expect(calls.length).toBe(3);                                       // 2 failures + 1 success
    expect(page.items).toEqual([]);
  });

  it('NEVER retries a mutation (POST) — fails on the first error', async () => {
    const { fn, calls } = fakeFetch(() => ({ status: 503, body: { code: 'X' } }));
    const c = createClient({ ...base, fetchImpl: fn, retries: 2 });
    await expect(c.auth.requestOtp('+919812345678', 'k')).rejects.toBeInstanceOf(SdkError);
    expect(calls.length).toBe(1);
  });

  it('times out a slow request', async () => {
    // model real fetch: it REJECTS when its AbortSignal fires (that's how the timeout surfaces).
    const slow = ((_u: any, init: any) => new Promise((_res, rej) => { init.signal?.addEventListener('abort', () => rej(new Error('aborted'))); })) as unknown as typeof fetch;
    const c = createClient({ ...base, fetchImpl: slow, timeoutMs: 20, retries: 0 });
    await expect(c.auth.me()).rejects.toBeInstanceOf(SdkTimeoutError);
  });

  it('the public trace scan hits /v1/traceability/scan/:token anonymously', async () => {
    const { fn, calls } = fakeFetch(() => ({ body: { data: { qrToken: 'QR1', listingId: null, declaredInputs: [], certificateIds: [], anchored: false, createdAt: '2026-01-01', events: [] } } }));
    const c = createClient({ ...base, fetchImpl: fn, getToken: () => 'tok' });
    const prov = await c.traceability.scan('QR1');
    expect(calls[0].url).toBe('https://api.test/v1/traceability/scan/QR1');
    expect((calls[0].init.headers as Record<string, string>).authorization).toBeUndefined();
    expect(prov.qrToken).toBe('QR1');
  });

  it('ambassadors.createReferral POSTs /v1/ambassadors/referrals with an idempotency key', async () => {
    const { fn, calls } = fakeFetch(() => ({ body: { data: { id: 'r1', referrerUserId: 'u1', refereeUserId: null, code: 'RAMESH24', status: 'invited', createdAt: '2026-01-01' } } }));
    const c = createClient({ ...base, fetchImpl: fn, getToken: () => 'tok' });
    const r = await c.ambassadors.createReferral('RAMESH24', 'idem-amb-1');
    expect(calls[0].url).toBe('https://api.test/v1/ambassadors/referrals');
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>)['idempotency-key']).toBe('idem-amb-1');
    expect(r.code).toBe('RAMESH24');
    expect(r.status).toBe('invited');
  });

  it('ambassadors.myEarnings unwraps the page and keeps money a string', async () => {
    const { fn, calls } = fakeFetch(() => ({ body: { data: [{ id: 'e1', ambassadorId: 'a1', eventCode: 'referral_activated', referenceType: null, referenceId: null, amountMinor: '250000', payoutId: null, createdAt: '2026-01-01' }], meta: { nextCursor: null } } }));
    const c = createClient({ ...base, fetchImpl: fn, getToken: () => 'tok' });
    const page = await c.ambassadors.myEarnings({ unpaidOnly: true });
    expect(calls[0].url).toBe('https://api.test/v1/ambassadors/me/earnings?unpaidOnly=true&limit=50');
    expect(page.items[0].amountMinor).toBe('250000');
    expect(typeof page.items[0].amountMinor).toBe('string');
  });

  it('enrollments.enroll POSTs /v1/education/enrollments with an idempotency key', async () => {
    const { fn, calls } = fakeFetch(() => ({ body: { data: { id: 'en1', courseId: 'c1', learnerUserId: 'u1', paymentId: null, progressPct: 0, completedAt: null, certificateMediaId: null, createdAt: '2026-01-01' } } }));
    const c = createClient({ ...base, fetchImpl: fn, getToken: () => 'tok' });
    const e = await c.enrollments.enroll('c1', 'idem-enroll-1');
    expect(calls[0].url).toBe('https://api.test/v1/education/enrollments');
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>)['idempotency-key']).toBe('idem-enroll-1');
    expect(e.courseId).toBe('c1');
  });

  it('enrollments.markProgress POSTs the lesson progress path', async () => {
    const { fn, calls } = fakeFetch(() => ({ body: { data: { lessonId: 'l1', completedAt: '2026-01-02', secondsWatched: 120, quizScore: 80 } } }));
    const c = createClient({ ...base, fetchImpl: fn, getToken: () => 'tok' });
    const p = await c.enrollments.markProgress('en1', 'l1', { secondsWatched: 120, quizScore: 80, completed: true });
    expect(calls[0].url).toBe('https://api.test/v1/education/enrollments/en1/lessons/l1/progress');
    expect(calls[0].init.method).toBe('POST');
    expect(p.quizScore).toBe(80);
  });

  it('rbac.assignments(pendingOnly) GETs the approval queue + approve POSTs', async () => {
    const { fn, calls } = fakeFetch((_c, n) => n === 1
      ? ({ body: { data: [{ id: 'utr1', userId: 'u1', roleCode: 'farmer', kycStatus: 'pending', isActive: false, approvedAt: null }] } })
      : ({ body: { data: { ok: true } } }));
    const c = createClient({ ...base, fetchImpl: fn, getToken: () => 'tok' });
    const list = await c.rbac.assignments({ pendingOnly: true });
    expect(calls[0].url).toBe('https://api.test/v1/rbac/assignments?pendingOnly=true');
    expect(list[0].roleCode).toBe('farmer');
    const r = await c.rbac.approveAssignment('utr1');
    expect(calls[1].url).toBe('https://api.test/v1/rbac/assignments/utr1/approve');
    expect(calls[1].init.method).toBe('POST');
    expect(r.ok).toBe(true);
  });

  it('disputes.resolve POSTs bigint-minor amount as a string', async () => {
    const { fn, calls } = fakeFetch(() => ({ body: { data: { id: 'd1', orderId: 'o1', raisedBy: 'r', againstUser: null, reasonId: null, description: null, status: 'resolved', sellerRespondBy: null, resolutionType: 'refund_partial', resolutionAmountMinor: '50000', resolvedBy: 'm', resolvedAt: '2026-01-02', slaDueAt: null } } }));
    const c = createClient({ ...base, fetchImpl: fn, getToken: () => 'tok' });
    const d = await c.disputes.resolve('d1', { resolutionType: 'refund_partial', resolutionAmountMinor: '50000' });
    expect(calls[0].url).toBe('https://api.test/v1/disputes/d1/resolve');
    expect(typeof d.resolutionAmountMinor).toBe('string');
    expect(d.resolutionAmountMinor).toBe('50000');
  });

  it('market.pulse GETs /v1/market/pulse and returns bigint-minor money as strings', async () => {
    const { fn, calls } = fakeFetch(() => ({ body: { data: {
      latest: { id: 'mp1', mandiId: 'm1', productId: 'p1', regionId: 'r1', minMinor: '90000', maxMinor: '110000', modalMinor: '100000', unitCode: 'qtl', priceDate: '2026-06-20' },
      band: { productId: 'p1', regionId: 'r1', p10Minor: '95000', p50Minor: '100000', p90Minor: '105000', forDate: '2026-06-21' },
      history: [],
    } } }));
    const c = createClient({ ...base, fetchImpl: fn, getToken: () => 'tok' });
    const pulse = await c.market.pulse('p1', 'r1');
    expect(calls[0].url).toBe('https://api.test/v1/market/pulse?productId=p1&regionId=r1');
    expect(calls[0].init.method).toBe('GET');
    expect(typeof pulse.latest.modalMinor).toBe('string');
    expect(pulse.band.p50Minor).toBe('100000');
  });

  it('market.createAlert POSTs /v1/market/alerts with an idempotency key + bigint-minor threshold', async () => {
    const { fn, calls } = fakeFetch(() => ({ body: { data: { id: 'al1', productId: 'p1', regionId: 'r1', direction: 'above', thresholdMinor: '12000000', isActive: true } } }));
    const c = createClient({ ...base, fetchImpl: fn, getToken: () => 'tok' });
    const a = await c.market.createAlert({ productId: 'p1', regionId: 'r1', direction: 'above', thresholdMinor: '12000000' }, 'idem-alert-1');
    expect(calls[0].url).toBe('https://api.test/v1/market/alerts');
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>)['idempotency-key']).toBe('idem-alert-1');
    expect(typeof a.thresholdMinor).toBe('string');
    expect(a.isActive).toBe(true);
  });

  it('weather.alerts GETs /v1/land/weather-alerts for a region', async () => {
    const { fn, calls } = fakeFetch(() => ({ body: { data: [{ id: 'w1', regionId: 'r1', severity: 'severe', validFrom: '2026-06-20T00:00:00Z', validTo: '2026-06-22T00:00:00Z', advisoryTextKey: 'weather.adv.heat' }] } }));
    const c = createClient({ ...base, fetchImpl: fn, getToken: () => 'tok' });
    const list = await c.weather.alerts('r1', { activeOnly: true });
    expect(calls[0].url).toBe('https://api.test/v1/land/weather-alerts?regionId=r1&activeOnly=true&limit=50');
    expect(list[0].severity).toBe('severe');
  });

  it('resources.list GETs /v1/education/resources with box=browse (approved only)', async () => {
    const { fn, calls } = fakeFetch(() => ({ body: { data: [{ id: 'res1', channelId: null, ownerUserId: 'u1', kind: 'article', title: 'Drip irrigation', externalUrl: null, mediaId: null, topicId: null, languageCode: 'hi', body: 'Save water', status: 'approved' }], meta: { nextCursor: 'c2' } } }));
    const c = createClient({ ...base, fetchImpl: fn, getToken: () => 'tok' });
    const page = await c.resources.list({ kind: 'article' });
    expect(calls[0].url).toBe('https://api.test/v1/education/resources?box=browse&kind=article&limit=50');
    expect(calls[0].init.method).toBe('GET');
    expect(page.items[0].kind).toBe('article');
    expect(page.nextCursor).toBe('c2');
  });

  it('assistant.ask POSTs /v1/ai/assistant/messages with an idempotency key + language', async () => {
    const { fn, calls } = fakeFetch(() => ({ body: { data: { reply: 'Use neem oil.', sessionId: 'sess1' } } }));
    const c = createClient({ ...base, fetchImpl: fn, getToken: () => 'tok' });
    const r = await c.assistant.ask({ message: 'pest on tomato?', languageCode: 'hi' }, 'idem-ai-1');
    expect(calls[0].url).toBe('https://api.test/v1/ai/assistant/messages');
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>)['idempotency-key']).toBe('idem-ai-1');
    expect(r.sessionId).toBe('sess1');
  });

  it('schemes.list GETs /v1/schemes and returns processingFee as a bigint-minor string', async () => {
    const { fn, calls } = fakeFetch(() => ({ body: { data: [{ id: 's1', code: 'PM-KISAN', name: 'PM Kisan', authorityId: 'a1', categoryId: 'c1', benefitSummary: {}, eligibilityRules: {}, requiredDocTypeIds: ['d1'], applicationWindow: null, applicableRegionIds: [], processingFeeMinor: '0', version: 1, isActive: true }] } }));
    const c = createClient({ ...base, fetchImpl: fn, getToken: () => 'tok' });
    const list = await c.schemes.list({ activeOnly: true });
    expect(calls[0].url).toBe('https://api.test/v1/schemes?activeOnly=true');
    expect(typeof list[0].processingFeeMinor).toBe('string');
    expect(list[0].requiredDocTypeIds).toEqual(['d1']);
  });

  it('schemes.checkEligibility POSTs /v1/schemes/:id/eligibility and returns explainable reasons', async () => {
    const { fn, calls } = fakeFetch(() => ({ body: { data: { eligible: false, reasons: ['minimum age 18'] } } }));
    const c = createClient({ ...base, fetchImpl: fn, getToken: () => 'tok' });
    const r = await c.schemes.checkEligibility('s1', { age: 16 });
    expect(calls[0].url).toBe('https://api.test/v1/schemes/s1/eligibility');
    expect(calls[0].init.method).toBe('POST');
    expect(r.eligible).toBe(false);
    expect(r.reasons[0]).toContain('age');
  });

  it('schemes.apply POSTs /v1/schemes/applications with an idempotency key', async () => {
    const { fn, calls } = fakeFetch(() => ({ body: { data: { id: 'app1', schemeId: 's1', schemeVersion: 1, applicantUserId: 'u1', assistedBy: null, status: 'draft', formData: { documents: [] }, govtAppRef: null, eligibilityCheck: null, submittedAt: null, decidedAt: null, rejectionReason: null } } }));
    const c = createClient({ ...base, fetchImpl: fn, getToken: () => 'tok' });
    const app = await c.schemes.apply({ schemeId: 's1', formData: { documents: [] } }, 'idem-apply-1');
    expect(calls[0].url).toBe('https://api.test/v1/schemes/applications');
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>)['idempotency-key']).toBe('idem-apply-1');
    expect(app.status).toBe('draft');
  });

  it('schemes.dbtTransfers GETs the application DBT credits as bigint-minor strings', async () => {
    const { fn, calls } = fakeFetch(() => ({ body: { data: [{ id: 'dbt1', applicationId: 'app1', userId: 'u1', schemeId: 's1', amountMinor: '600000', instalmentNo: 1, creditedOn: '2026-04-01', pfmsRef: 'PFMS123' }] } }));
    const c = createClient({ ...base, fetchImpl: fn, getToken: () => 'tok' });
    const list = await c.schemes.dbtTransfers('app1');
    expect(calls[0].url).toBe('https://api.test/v1/schemes/applications/app1/dbt');
    expect(typeof list[0].amountMinor).toBe('string');
    expect(list[0].amountMinor).toBe('600000');
  });
});
