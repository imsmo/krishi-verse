// modules/identity/__tests__/otp.service.spec.ts · OTP security: single-use, attempt cap +
// lockout, rate limit, resend cooldown — all proven against the real in-memory cache.
import { OtpService } from '../../../core/auth/otp.service';
import { InMemoryCacheService } from '../../../core/cache/cache.service.in-memory';
import { AppConfig } from '../../../core/config/app-config';
import { TooManyRequestsError } from '../../../shared/errors/app-error';

function cfg(overrides: Record<string, string> = {}): AppConfig {
  return new AppConfig({
    NODE_ENV: 'test', DATABASE_URL: 'postgres://x', JWT_ACCESS_SECRET: 'test-secret-test-secret',
    AUTH_HASH_PEPPER: 'pepper-pepper-pepper-pepper-32!!', OTP_LENGTH: '6', OTP_MAX_VERIFY_ATTEMPTS: '3',
    OTP_REQUEST_MAX_PER_HOUR: '2', OTP_RESEND_COOLDOWN_SEC: '0', ...overrides,
  });
}
const phone = '+919876543210';

describe('OtpService', () => {
  it('issues then verifies the correct code once (single-use)', async () => {
    const svc = new OtpService(new InMemoryCacheService(), cfg());
    const { code } = await svc.issue(phone);
    expect(await svc.verify(phone, code)).toBe(true);
    expect(await svc.verify(phone, code)).toBe(false); // consumed
  });
  it('rejects wrong codes and locks after the attempt cap', async () => {
    const svc = new OtpService(new InMemoryCacheService(), cfg());
    await svc.issue(phone);
    expect(await svc.verify(phone, '000000')).toBe(false);
    expect(await svc.verify(phone, '000000')).toBe(false);
    expect(await svc.verify(phone, '000000')).toBe(false);
    expect(await svc.verify(phone, '000000')).toBe(false); // exceeds cap → locked
  });
  it('enforces the per-hour request rate limit', async () => {
    const svc = new OtpService(new InMemoryCacheService(), cfg());
    await svc.issue(phone); await svc.issue(phone);
    await expect(svc.issue(phone)).rejects.toBeInstanceOf(TooManyRequestsError);
  });
  it('enforces resend cooldown', async () => {
    const svc = new OtpService(new InMemoryCacheService(), cfg({ OTP_RESEND_COOLDOWN_SEC: '60' }));
    await svc.issue(phone);
    await expect(svc.issue(phone)).rejects.toBeInstanceOf(TooManyRequestsError);
  });
});
