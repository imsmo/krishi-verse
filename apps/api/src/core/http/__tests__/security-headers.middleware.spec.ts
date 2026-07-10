// core/http/__tests__/security-headers.middleware.spec.ts
// Regression tests for the zero-dep security-header baseline (ZAP-hardening, pre-scan):
//   • the always-on headers are present on every response,
//   • HSTS is production-ONLY (never sent on a plain-HTTP dev/staging origin),
//   • Cache-Control: no-store is applied to the auth/payments-umbrella routes, and never clobbers a
//     handler that already set its own Cache-Control.
import { SecurityHeadersMiddleware } from '../security-headers.middleware';
import { AppConfig } from '../../config/app-config';

function reqFor(path: string) {
  return { path } as any;
}

function resFactory(existingCacheControl?: string) {
  const headers: Record<string, string> = {};
  if (existingCacheControl) headers['Cache-Control'] = existingCacheControl;
  return {
    setHeader: jest.fn((k: string, v: string) => { headers[k] = v; }),
    getHeader: jest.fn((k: string) => headers[k]),
    _headers: headers,
  } as any;
}

function configStub(isProd: boolean): AppConfig {
  return { isProd } as unknown as AppConfig;
}

describe('SecurityHeadersMiddleware', () => {
  it('sets the always-on headers regardless of environment', () => {
    const mw = new SecurityHeadersMiddleware(configStub(false));
    const res = resFactory();
    const next = jest.fn();
    mw.use(reqFor('/v1/listings'), res, next);

    expect(res._headers['X-Content-Type-Options']).toBe('nosniff');
    expect(res._headers['X-Frame-Options']).toBe('DENY');
    expect(res._headers['Referrer-Policy']).toBe('no-referrer');
    expect(res._headers['Permissions-Policy']).toBe('geolocation=(), camera=(), microphone=()');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('sends HSTS only in production (TLS terminates at the ALB elsewhere)', () => {
    const dev = resFactory();
    new SecurityHeadersMiddleware(configStub(false)).use(reqFor('/v1/listings'), dev, jest.fn());
    expect(dev._headers['Strict-Transport-Security']).toBeUndefined();

    const prod = resFactory();
    new SecurityHeadersMiddleware(configStub(true)).use(reqFor('/v1/listings'), prod, jest.fn());
    expect(prod._headers['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains');
  });

  it.each([
    '/v1/auth/login',
    '/v1/auth/otp/verify',
    '/v1/payments/webhooks/razorpay',
    '/v1/payouts',
    '/v1/wallet/autopay',
    '/v1/invoices/123',
    '/v1/settlement-statements',
    '/v1/commission-rules',
  ])('sets Cache-Control: no-store on auth/payment route %s', (path) => {
    const res = resFactory();
    new SecurityHeadersMiddleware(configStub(true)).use(reqFor(path), res, jest.fn());
    expect(res._headers['Cache-Control']).toBe('no-store');
  });

  it('does NOT set Cache-Control on an unrelated route', () => {
    const res = resFactory();
    new SecurityHeadersMiddleware(configStub(true)).use(reqFor('/v1/listings/abc'), res, jest.fn());
    expect(res._headers['Cache-Control']).toBeUndefined();
  });

  it('never clobbers a Cache-Control the handler/interceptor already set', () => {
    const res = resFactory('private, max-age=5');
    new SecurityHeadersMiddleware(configStub(true)).use(reqFor('/v1/payments/xyz'), res, jest.fn());
    expect(res._headers['Cache-Control']).toBe('private, max-age=5');
  });

  it('always calls next()', () => {
    const next = jest.fn();
    new SecurityHeadersMiddleware(configStub(true)).use(reqFor('/v1/auth/login'), resFactory(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
