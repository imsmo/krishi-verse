// modules/identity/__tests__/token.service.spec.ts · JWT mint/verify + refresh hashing.
import { TokenService } from '../../../core/auth/token.service';
import { AppConfig } from '../../../core/config/app-config';

const config = new AppConfig({ NODE_ENV: 'test', DATABASE_URL: 'postgres://x', JWT_ACCESS_SECRET: 'access-secret-access-secret', JWT_REFRESH_SECRET: 'refresh-secret-refresh-secret', AUTH_HASH_PEPPER: 'pepper-pepper-pepper-pepper-32!!' });

describe('TokenService', () => {
  const svc = new TokenService(config);
  it('mints and verifies an access token round-trip', () => {
    const t = svc.mintAccessToken({ sub: 'u1', tid: 't1', sid: 's1', roles: ['farmer'], perms: ['listing.create'] });
    const c = svc.verifyAccessToken(t)!;
    expect(c.sub).toBe('u1'); expect(c.tid).toBe('t1'); expect(c.perms).toContain('listing.create');
  });
  it('rejects a tampered/garbage token', () => {
    expect(svc.verifyAccessToken('not.a.jwt')).toBeNull();
  });
  it('refresh token hash compares constant-time correctly', () => {
    const { token, hash } = svc.newRefreshToken();
    expect(svc.refreshMatches(token, hash)).toBe(true);
    expect(svc.refreshMatches(token + 'x', hash)).toBe(false);
    expect(svc.refreshMatches('other', hash)).toBe(false);
  });
});
