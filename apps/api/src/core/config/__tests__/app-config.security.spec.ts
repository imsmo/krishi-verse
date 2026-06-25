// core/config/__tests__/app-config.security.spec.ts
// Proves assertProductionSecurity FAILS CLOSED: a secure prod env boots; any weak/dev/misconfigured value
// is reported (and crashes the constructor in production). These are the regression tests for P0-2.
import { AppConfig } from '../app-config';
import { validateEnv, Env } from '../env.validation';

// A fully-secure production env (all the things assertProductionSecurity checks, set correctly).
const SECURE_RAW: Record<string, string> = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://kv_app:Str0ng-Db-Passw0rd-9x@db.cluster.ap-south-1.rds.amazonaws.com:5432/krishiverse',
  JWT_ACCESS_SECRET: 'Zx9Qw7Vb3Nm2Kp5Lr8Td1Gh4Js6Fd0Ay2Bc7Xe', // 39 chars, no dev pattern
  JWT_REFRESH_SECRET: 'Rt4Yh8Uj2Ik6Ol0Pa5Sd9Fg3Hj7Kl1Zx5Cv9Bn', // distinct
  AUTH_HASH_PEPPER: 'Pa5Sd9Fg3Hj7Kl1Zx5Cv9BnMq2Wr6Et8Yu4Io0', // 39 chars
  AUTH_EXPOSE_OTP: 'false',
  REDIS_URL: 'rediss://:tok3nXyz@redis.cluster.ap-south-1.cache.amazonaws.com:6379',
  S3_MEDIA_BUCKET: 'krishiverse-prod-media-123456789012',
  RAZORPAY_KEY_ID: 'rzp_live_abc123',
  RAZORPAY_WEBHOOK_SECRET: 'whsec_live_strong_secret_abcdef0123456789',
  SMS_PROVIDER: 'msg91',
  MSG91_AUTH_KEY: 'msg91-live-auth-key',
  MSG91_OTP_TEMPLATE_ID: '64a1b2c3template',
  MSG91_SENDER_ID: 'KRSHVR',
};

const envWith = (overrides: Record<string, string | undefined>): Env => {
  const raw = { ...SECURE_RAW };
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete raw[k];
    else raw[k] = v;
  }
  return validateEnv(raw);
};

describe('AppConfig.collectProductionProblems (fail-closed)', () => {
  it('a fully-secure production env has ZERO problems', () => {
    expect(AppConfig.collectProductionProblems(envWith({}))).toEqual([]);
  });

  it('constructor boots on a secure prod env, throws on an insecure one', () => {
    expect(() => new AppConfig(envWith({}) as unknown as Record<string, unknown>)).not.toThrow();
    expect(() => new AppConfig({ ...SECURE_RAW, JWT_ACCESS_SECRET: 'dev-secret-change-me' })).toThrow(/insecure production config/i);
  });

  it.each([
    ['weak JWT access secret', { JWT_ACCESS_SECRET: 'dev-secret-change-me-32-characters' }, /JWT_ACCESS_SECRET/],
    ['access === refresh', { JWT_REFRESH_SECRET: SECURE_RAW.JWT_ACCESS_SECRET }, /must differ/],
    ['OTP exposure on', { AUTH_EXPOSE_OTP: 'true' }, /AUTH_EXPOSE_OTP/],
    ['DB on localhost', { DATABASE_URL: 'postgresql://kv_app:Str0ng-Db-Passw0rd-9x@localhost:5432/krishiverse' }, /localhost/],
    ['DB as superuser', { DATABASE_URL: 'postgresql://postgres:Str0ng-Db-Passw0rd-9x@db.rds.amazonaws.com:5432/k' }, /least-privilege/],
    ['DB dev password', { DATABASE_URL: 'postgresql://kv_app:dev@db.rds.amazonaws.com:5432/krishiverse' }, /strong, non-default password/],
    ['DB sslmode=disable', { DATABASE_URL: 'postgresql://kv_app:Str0ng-Db-Passw0rd-9x@db.rds.amazonaws.com:5432/k?sslmode=disable' }, /TLS/],
    ['Redis missing', { REDIS_URL: undefined }, /REDIS_URL must be set/],
    ['Redis non-TLS', { REDIS_URL: 'redis://redis.cache.amazonaws.com:6379' }, /TLS \(rediss/],
    ['Redis localhost', { REDIS_URL: 'rediss://localhost:6379' }, /localhost/],
    ['S3 bucket missing', { S3_MEDIA_BUCKET: undefined }, /S3_MEDIA_BUCKET/],
    ['S3 static key present', { S3_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE' }, /static keys must be EMPTY/],
    ['S3 MinIO endpoint', { S3_ENDPOINT: 'http://minio:9000' }, /S3_ENDPOINT must be empty/],
    ['OpenSearch http', { OPENSEARCH_URL: 'http://search.local:9200' }, /https/],
    ['OpenSearch no auth', { OPENSEARCH_URL: 'https://search.es.amazonaws.com' }, /USERNAME\/PASSWORD/],
    ['payments not configured', { RAZORPAY_KEY_ID: undefined }, /RAZORPAY_KEY_ID must be set/],
    ['payments weak webhook secret', { RAZORPAY_WEBHOOK_SECRET: 'sandbox-secret' }, /RAZORPAY_WEBHOOK_SECRET/],
    ['notify gateway without secret', { NOTIFY_GATEWAY_URL: 'https://notify.example.com', NOTIFY_WEBHOOK_SECRET: undefined }, /NOTIFY_WEBHOOK_SECRET/],
    ['masking provider without secret', { MASKING_PROVIDER_URL: 'https://mask.example.com', MASKING_WEBHOOK_SECRET: undefined }, /MASKING_WEBHOOK_SECRET/],
    ['SMS provider noop in prod', { SMS_PROVIDER: 'noop' }, /SMS_PROVIDER must be/],
    ['MSG91 without template', { SMS_PROVIDER: 'msg91', MSG91_OTP_TEMPLATE_ID: undefined }, /MSG91_/],
    ['Twilio without creds', { SMS_PROVIDER: 'twilio', TWILIO_ACCOUNT_SID: undefined }, /TWILIO_/],
  ])('flags %s', (_label, overrides, pattern) => {
    const problems = AppConfig.collectProductionProblems(envWith(overrides));
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join('; ')).toMatch(pattern as RegExp);
  });

  it('does NOT run the prod gate outside production', () => {
    // a deliberately weak env is fine in development — the gate only fires in production
    expect(() => new AppConfig({ NODE_ENV: 'development', DATABASE_URL: 'postgresql://kv_app:dev@localhost:5432/k', JWT_ACCESS_SECRET: 'dev-secret-change-me-16x' })).not.toThrow();
  });
});
