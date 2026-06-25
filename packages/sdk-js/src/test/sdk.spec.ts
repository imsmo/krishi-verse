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

  it('users.me GETs /v1/users/me and updateMe PATCHes it', async () => {
    const { fn, calls } = fakeFetch(() => ({ body: { data: { id: 'u1', displayName: 'Ram', roles: ['farmer'], locale: 'hi' } } }));
    const c = createClient({ ...base, fetchImpl: fn, getToken: () => 'tok' });
    const me = await c.users.me();
    expect(calls[0].url).toBe('https://api.test/v1/users/me');
    expect(me.displayName).toBe('Ram');
    await c.users.updateMe({ fullName: 'Ram Kumar', email: 'ram@x.com' });
    expect(calls[1].url).toBe('https://api.test/v1/users/me');
    expect(calls[1].init.method).toBe('PATCH');
  });

  it('support.open POSTs /v1/support/tickets with an idempotency key + channel=app', async () => {
    const { fn, calls } = fakeFetch(() => ({ body: { data: { id: 'tk1', ticketNo: 'T-1', requesterUserId: 'u1', channel: 'app', categoryId: null, severity: 'P2', subject: 'help', status: 'open', assigneeUserId: null, conversationId: null, slaFirstResponseDue: null, slaResolutionDue: '2026-06-22T00:00:00Z', firstRespondedAt: null, resolvedAt: null, csatScore: null } } }));
    const c = createClient({ ...base, fetchImpl: fn, getToken: () => 'tok' });
    const tk = await c.support.open({ subject: 'help', severity: 'P2' }, 'idem-tk-1');
    expect(calls[0].url).toBe('https://api.test/v1/support/tickets');
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>)['idempotency-key']).toBe('idem-tk-1');
    expect(tk.status).toBe('open');
  });

  it('support.myTickets GETs box=mine; submitCsat POSTs the score', async () => {
    const { fn, calls } = fakeFetch((_c, n) => n === 1
      ? ({ body: { data: [{ id: 'tk1', ticketNo: 'T-1', requesterUserId: 'u1', channel: 'app', categoryId: null, severity: 'P2', subject: 's', status: 'resolved', assigneeUserId: null, conversationId: null, slaFirstResponseDue: null, slaResolutionDue: null, firstRespondedAt: null, resolvedAt: '2026-06-21', csatScore: null }], meta: { nextCursor: null } } })
      : ({ body: { data: { id: 'tk1', ticketNo: 'T-1', requesterUserId: 'u1', channel: 'app', categoryId: null, severity: 'P2', subject: 's', status: 'resolved', assigneeUserId: null, conversationId: null, slaFirstResponseDue: null, slaResolutionDue: null, firstRespondedAt: null, resolvedAt: '2026-06-21', csatScore: 5 } } }));
    const c = createClient({ ...base, fetchImpl: fn, getToken: () => 'tok' });
    const page = await c.support.myTickets();
    expect(calls[0].url).toBe('https://api.test/v1/support/tickets?box=mine&limit=50');
    const rated = await c.support.submitCsat('tk1', 5);
    expect(calls[1].url).toBe('https://api.test/v1/support/tickets/tk1/csat');
    expect(rated.csatScore).toBe(5);
  });

  it('parcels.register POSTs /v1/land/parcels with an idempotency key + areaValue string', async () => {
    const { fn, calls } = fakeFetch(() => ({ body: { data: { id: 'p1', ownerUserId: 'u1', regionId: null, surveyNo: '12/3', bhulekhRef: null, area: '2.5000', areaUnit: 'acre', irrigationTypeId: null, boundaryGeojson: null, verificationStatus: 'pending', isTenantFarmed: false } } }));
    const c = createClient({ ...base, fetchImpl: fn, getToken: () => 'tok' });
    const p = await c.parcels.register({ areaValue: '2.5', surveyNo: '12/3' }, 'idem-parcel-1');
    expect(calls[0].url).toBe('https://api.test/v1/land/parcels');
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>)['idempotency-key']).toBe('idem-parcel-1');
    expect(typeof p.area).toBe('string');
    expect(p.verificationStatus).toBe('pending');
  });

  it('privacy.requestDataExport POSTs /v1/privacy/export-requests with an idempotency key', async () => {
    const { fn, calls } = fakeFetch(() => ({ body: { data: { id: 'req1', kind: 'export', status: 'pending' } } }));
    const c = createClient({ ...base, fetchImpl: fn, getToken: () => 'tok' });
    const r = await c.privacy.requestDataExport('idem-exp-1');
    expect(calls[0].url).toBe('https://api.test/v1/privacy/export-requests');
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>)['idempotency-key']).toBe('idem-exp-1');
    expect(r.kind).toBe('export');
  });

  it('privacy.requestAccountDeletion POSTs /v1/privacy/deletion-requests (idempotent)', async () => {
    const { fn, calls } = fakeFetch(() => ({ body: { data: { id: 'req2', kind: 'deletion', status: 'pending' } } }));
    const c = createClient({ ...base, fetchImpl: fn, getToken: () => 'tok' });
    const r = await c.privacy.requestAccountDeletion({ reason: 'moving on' }, 'idem-del-1');
    expect(calls[0].url).toBe('https://api.test/v1/privacy/deletion-requests');
    expect((calls[0].init.headers as Record<string, string>)['idempotency-key']).toBe('idem-del-1');
    expect(r.kind).toBe('deletion');
  });

  it('privacy.startPhoneChange POSTs /v1/auth/change-phone/start with an idempotency key', async () => {
    const { fn, calls } = fakeFetch(() => ({ body: { data: { ok: true } } }));
    const c = createClient({ ...base, fetchImpl: fn, getToken: () => 'tok' });
    const r = await c.privacy.startPhoneChange('+919812345678', 'idem-ph-1');
    expect(calls[0].url).toBe('https://api.test/v1/auth/change-phone/start');
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>)['idempotency-key']).toBe('idem-ph-1');
    expect(r.ok).toBe(true);
  });

  it('getHeaders injects extra headers but can NEVER override reserved ones (auth/idempotency/tenant)', async () => {
    const { fn, calls } = fakeFetch(() => ({ body: { data: { ok: true } } }));
    const c = createClient({
      ...base, fetchImpl: fn, getToken: () => 'real-tok', tenantSlug: 'acme',
      getHeaders: async () => ({ 'x-device-integrity': 'posture=unknown;root=0;emu=0', authorization: 'Bearer SPOOF', 'idempotency-key': 'spoof', 'x-tenant-slug': 'evil' }),
    });
    await c.schemes.submitApplication('app1', 'real-idem');
    const h = calls[0].init.headers as Record<string, string>;
    expect(h['x-device-integrity']).toBe('posture=unknown;root=0;emu=0'); // extra header applied
    expect(h.authorization).toBe('Bearer real-tok');                       // reserved: real token wins
    expect(h['idempotency-key']).toBe('real-idem');                        // reserved: real key wins
    expect(h['x-tenant-slug']).toBe('acme');                               // reserved: real tenant wins
  });

  it('a throwing getHeaders never blocks the request (degrade)', async () => {
    const { fn } = fakeFetch(() => ({ body: { data: [] } }));
    const c = createClient({ ...base, fetchImpl: fn, getToken: () => 'tok', getHeaders: async () => { throw new Error('attest failed'); } });
    await expect(c.schemes.list()).resolves.toEqual([]);
  });

  it('wallet.earnings / spendingInsights build the right GET URLs with window + currency, money stays string', async () => {
    const { fn, calls } = fakeFetch(() => ({ body: { data: { fromIso: '2026-01-01T00:00:00.000Z', toIso: '2026-06-01T00:00:00.000Z', currencyCode: 'INR', totalMinor: '123456789012345', byMonth: [{ key: '2026-05', amountMinor: '1000', count: 2 }], byType: [] } } }));
    const c = createClient({ ...base, fetchImpl: fn, getToken: () => 'tok' });
    const e = await c.wallet.earnings({ from: '2026-01-01', to: '2026-06-01' });
    expect(calls[0].url).toBe('https://api.test/v1/wallet/earnings?from=2026-01-01&to=2026-06-01&currency=INR');
    expect(calls[0].init.method).toBe('GET');
    expect(e.totalMinor).toBe('123456789012345');
    expect(typeof e.byMonth[0].amountMinor).toBe('string');
    await c.wallet.spendingInsights();
    expect(calls[1].url).toBe('https://api.test/v1/wallet/spending-insights?currency=INR');
  });

  it('autopay.register POSTs to wallet/autopay with an Idempotency-Key; cancel DELETEs by id', async () => {
    const { fn, calls } = fakeFetch(() => ({ body: { data: { id: 'm1', status: 'pending', purpose: 'membership', vpaMasked: 'fa***@okhdfcbank', provider: 'razorpay', maxAmountMinor: '50000', currencyCode: 'INR', frequency: 'monthly', validUntil: null, createdAt: '2026-06-01T00:00:00.000Z' } } }));
    const c = createClient({ ...base, fetchImpl: fn, getToken: () => 'tok' });
    const m = await c.autopay.register({ vpa: 'farmer.kumar@okhdfcbank', purpose: 'membership', maxAmountMinor: '50000', frequency: 'monthly' }, 'idem-ap-1');
    expect(calls[0].url).toBe('https://api.test/v1/wallet/autopay');
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>)['idempotency-key']).toBe('idem-ap-1');
    expect(m.vpaMasked).toBe('fa***@okhdfcbank');
    await c.autopay.cancel('m1', 'no longer needed');
    expect(calls[1].url).toBe('https://api.test/v1/wallet/autopay/m1');
    expect(calls[1].init.method).toBe('DELETE');
  });

  it('autopay.list builds the keyset GET URL and unwraps the page', async () => {
    const { fn, calls } = fakeFetch(() => ({ body: { data: [{ id: 'm1', status: 'active', purpose: 'general', vpaMasked: 'ab***@upi', provider: 'razorpay', maxAmountMinor: '1000', currencyCode: 'INR', frequency: 'as_presented', validUntil: null, createdAt: 'x' }], meta: { nextCursor: 'c2' } } }));
    const c = createClient({ ...base, fetchImpl: fn, getToken: () => 'tok' });
    const page = await c.autopay.list(undefined, 50);
    expect(calls[0].url).toBe('https://api.test/v1/wallet/autopay?limit=50');
    expect(page.items[0].id).toBe('m1');
    expect(page.nextCursor).toBe('c2');
  });

  it('kyc.startEkyc / verifyEkyc POST the eKYC paths with an Idempotency-Key; only masked values returned', async () => {
    const { fn, calls } = fakeFetch(() => ({ body: { data: { id: 's1', docType: 'aadhaar', maskedId: 'XXXXXXXX0019', otpRequired: true } } }));
    const c = createClient({ ...base, fetchImpl: fn, getToken: () => 'tok' });
    const started = await c.kyc.startEkyc({ docType: 'aadhaar', idNumber: '999999990019' }, 'idem-ek-1');
    expect(calls[0].url).toBe('https://api.test/v1/kyc/ekyc/start');
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>)['idempotency-key']).toBe('idem-ek-1');
    expect(started.maskedId).toBe('XXXXXXXX0019');
    // the raw id must never appear in the response surface
    expect(JSON.stringify(started)).not.toContain('999999990019');

    const { fn: fn2, calls: calls2 } = fakeFetch(() => ({ body: { data: { id: 's1', status: 'verified', docType: 'aadhaar', maskedId: 'XXXXXXXX0019', nameMatch: true } } }));
    const c2 = createClient({ ...base, fetchImpl: fn2, getToken: () => 'tok' });
    const v = await c2.kyc.verifyEkyc({ sessionId: 's1', otp: '123456' }, 'idem-ek-2');
    expect(calls2[0].url).toBe('https://api.test/v1/kyc/ekyc/verify');
    expect(calls2[0].init.method).toBe('POST');
    expect(v.status).toBe('verified');
  });

  it('labour.clockOut POSTs the clock-out path with break + Idempotency-Key; hours come back as numbers', async () => {
    const { fn, calls } = fakeFetch(() => ({ body: { data: { id: 'a1', assignmentId: 'as1', bookingId: 'b1', workDate: '2026-06-01', status: 'clocked_out', clockOutAt: '2026-06-01T16:00:00.000Z', hoursRegular: 8, hoursOvertime: 1.5 } } }));
    const c = createClient({ ...base, fetchImpl: fn, getToken: () => 'tok' });
    const a = await c.labour.clockOut('as1', 30, 'idem-co-1');
    expect(calls[0].url).toBe('https://api.test/v1/labour/assignments/as1/attendance/clock-out');
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>)['idempotency-key']).toBe('idem-co-1');
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ breakMinutes: 30 });
    expect(a.hoursOvertime).toBe(1.5);
  });

  it('labour.confirmAttendance POSTs the confirm path with the workDate body', async () => {
    const { fn, calls } = fakeFetch(() => ({ body: { data: { id: 'a1', assignmentId: 'as1', bookingId: 'b1', workDate: '2026-06-01', status: 'confirmed' } } }));
    const c = createClient({ ...base, fetchImpl: fn, getToken: () => 'tok' });
    const a = await c.labour.confirmAttendance('as1', '2026-06-01', 'idem-cf-1');
    expect(calls[0].url).toBe('https://api.test/v1/labour/assignments/as1/attendance/confirm');
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ workDate: '2026-06-01' });
    expect(a.status).toBe('confirmed');
  });

  it('labour.workHistory GETs the keyset history path and unwraps the page', async () => {
    const { fn, calls } = fakeFetch(() => ({ body: { data: [{ id: 'a1', assignmentId: 'as1', bookingId: 'b1', workDate: '2026-06-01', status: 'confirmed', hoursRegular: 8, hoursOvertime: 0 }], meta: { nextCursor: 'h2' } } }));
    const c = createClient({ ...base, fetchImpl: fn, getToken: () => 'tok' });
    const page = await c.labour.workHistory(undefined, 50);
    expect(calls[0].url).toBe('https://api.test/v1/labour/assignments/attendance/history?limit=50');
    expect(page.items[0].status).toBe('confirmed');
    expect(page.nextCursor).toBe('h2');
  });
});
