// core/config/app-config.ts
// The ONLY place process.env is read. Everywhere else injects AppConfig — typed,
// validated, mockable. Rule of thumb:
//   infrastructure values (URLs, keys, pools)  → env vars / Secrets Manager (here)
//   business values (commission %, languages…) → DATABASE tables — NEVER env vars.
import { Injectable } from '@nestjs/common';
import { validateEnv, Env } from './env.validation';

@Injectable()
export class AppConfig {
  private readonly env: Env;
  constructor(raw: Record<string, unknown> = process.env) {
    this.env = validateEnv(raw);
    this.assertProductionSecurity(); // fail-closed: a weak prod secret crashes boot, never ships
  }

  /** In production, refuse to start with dev/weak secrets or OTP exposure enabled. */
  private assertProductionSecurity(): void {
    if (this.env.NODE_ENV !== 'production') return;
    const weak = (v: string) => !v || v.length < 32 || /change-?me|dev-|test|secret-secret|placeholder/i.test(v);
    const problems: string[] = [];
    if (weak(this.env.JWT_ACCESS_SECRET)) problems.push('JWT_ACCESS_SECRET (set a unique random >=32 chars)');
    if (weak(this.env.JWT_REFRESH_SECRET)) problems.push('JWT_REFRESH_SECRET (set a unique random >=32 chars)');
    if (weak(this.env.AUTH_HASH_PEPPER)) problems.push('AUTH_HASH_PEPPER (set a unique random >=32 chars)');
    if (this.env.JWT_ACCESS_SECRET === this.env.JWT_REFRESH_SECRET) problems.push('JWT access and refresh secrets must differ');
    if (this.env.AUTH_EXPOSE_OTP === 'true') problems.push('AUTH_EXPOSE_OTP must be false in production');
    if (problems.length) throw new Error(`FATAL: insecure production config -> ${problems.join('; ')}`);
  }

  get nodeEnv()    { return this.env.NODE_ENV; }
  get port()       { return this.env.PORT; }
  get isProd()     { return this.env.NODE_ENV === 'production'; }
  get shardCount() { return this.env.SHARD_COUNT; }

  get db() {
    return {
      writerUrl: this.env.DATABASE_URL,
      replicaUrl: this.env.DATABASE_REPLICA_URL && this.env.DATABASE_REPLICA_URL.length > 0
        ? this.env.DATABASE_REPLICA_URL : this.env.DATABASE_URL,
      poolMax: this.env.DATABASE_POOL_MAX,
    };
  }
  get redis()  { return { url: this.env.REDIS_URL ?? null }; }
  get search() { return { url: this.env.OPENSEARCH_URL ?? null }; }
  get jwt()    { return { accessSecret: this.env.JWT_ACCESS_SECRET, issuer: this.env.JWT_ISSUER, audience: this.env.JWT_AUDIENCE }; }
  get auth() {
    return {
      accessSecret: this.env.JWT_ACCESS_SECRET,
      refreshSecret: this.env.JWT_REFRESH_SECRET,
      issuer: this.env.JWT_ISSUER,
      audience: this.env.JWT_AUDIENCE,
      accessTtlSec: this.env.JWT_ACCESS_TTL_SEC,
      refreshTtlSec: this.env.JWT_REFRESH_TTL_SEC,
      hashPepper: this.env.AUTH_HASH_PEPPER,
      otp: {
        ttlSec: this.env.OTP_TTL_SEC,
        length: this.env.OTP_LENGTH,
        maxVerifyAttempts: this.env.OTP_MAX_VERIFY_ATTEMPTS,
        requestMaxPerHour: this.env.OTP_REQUEST_MAX_PER_HOUR,
        resendCooldownSec: this.env.OTP_RESEND_COOLDOWN_SEC,
        verifyMaxPerHour: this.env.OTP_VERIFY_MAX_PER_HOUR,
      },
      exposeOtp: this.env.AUTH_EXPOSE_OTP !== undefined ? this.env.AUTH_EXPOSE_OTP === 'true' : this.env.NODE_ENV === 'test',
    };
  }
  get wallet() { return { grpcUrl: this.env.WALLET_GRPC_URL }; }
  get razorpay(){ return { keyId: this.env.RAZORPAY_KEY_ID, webhookSecret: this.env.RAZORPAY_WEBHOOK_SECRET }; }
  get smsBudgetPaise() { return this.env.SMS_DAILY_BUDGET_PAISE; }
}
