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

  /**
   * Fail CLOSED in production. A weak/dev/misconfigured value crashes boot loudly — it never ships.
   * Covers: auth secrets, OTP exposure, the DB connection (no localhost/superuser/dev-password), Redis TLS,
   * S3 (IRSA only — no static keys), OpenSearch TLS+auth, and every external-provider webhook secret that is
   * meaningless if weak. Exported as a pure helper (collectProductionProblems) so it is unit-testable.
   */
  private assertProductionSecurity(): void {
    if (this.env.NODE_ENV !== 'production') return;
    const problems = AppConfig.collectProductionProblems(this.env);
    if (problems.length) throw new Error(`FATAL: insecure production config -> ${problems.join('; ')}`);
  }

  /** Pure: given the validated env, list every production-security problem. Empty = safe to boot. */
  static collectProductionProblems(env: Env): string[] {
    const p: string[] = [];
    const weak = (v?: string) =>
      !v || v.length < 32 || /change-?me|dev-|^test|secret-secret|placeholder|sandbox-secret|^changeme/i.test(v);
    const weak16 = (v?: string) => !v || v.length < 16 || /change-?me|dev-|^test|placeholder|sandbox-secret/i.test(v);

    // --- auth ---
    if (weak(env.JWT_ACCESS_SECRET)) p.push('JWT_ACCESS_SECRET (unique random >=32 chars)');
    if (weak(env.JWT_REFRESH_SECRET)) p.push('JWT_REFRESH_SECRET (unique random >=32 chars)');
    if (weak(env.AUTH_HASH_PEPPER)) p.push('AUTH_HASH_PEPPER (unique random >=32 chars)');
    if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) p.push('JWT access and refresh secrets must differ');
    if (env.AUTH_EXPOSE_OTP === 'true') p.push('AUTH_EXPOSE_OTP must be false in production');

    // --- primary database: must be a real managed endpoint, least-privilege role, strong password ---
    for (const [label, url] of [['DATABASE_URL', env.DATABASE_URL], ['DATABASE_REPLICA_URL', env.DATABASE_REPLICA_URL]] as const) {
      if (!url) continue;
      const u = AppConfig.tryParsePg(url);
      if (!u) { p.push(`${label} is not a valid postgres URL`); continue; }
      if (/^(localhost|127\.|::1|0\.0\.0\.0)/.test(u.host)) p.push(`${label} must not point at localhost in production`);
      if (['postgres', 'rdsadmin', 'root', 'admin', 'kv_owner'].includes(u.user)) p.push(`${label} must use a least-privilege role (kv_app), not a superuser/owner`);
      if (!u.password || /^(postgres|password|dev|changeme|admin|secret)$/i.test(u.password) || u.password.length < 12) p.push(`${label} must use a strong, non-default password (from Secrets Manager)`);
      if (u.sslDisabled) p.push(`${label} must require TLS (sslmode=require), not disable it`);
    }

    // --- Redis: required + TLS + not localhost (rate-limits/OTP store/realtime bus) ---
    if (!env.REDIS_URL) p.push('REDIS_URL must be set in production');
    else {
      if (!/^rediss:\/\//.test(env.REDIS_URL)) p.push('REDIS_URL must use TLS (rediss://) in production');
      if (/@?(localhost|127\.0\.0\.1)/.test(env.REDIS_URL)) p.push('REDIS_URL must not point at localhost in production');
    }

    // --- S3 media: IRSA only — static keys are forbidden in prod; no MinIO endpoint ---
    if (!env.S3_MEDIA_BUCKET) p.push('S3_MEDIA_BUCKET must be set in production');
    if (env.S3_ACCESS_KEY_ID || env.S3_SECRET_ACCESS_KEY) p.push('S3 static keys must be EMPTY in production (use the IRSA role, no long-lived keys)');
    if (env.S3_ENDPOINT) p.push('S3_ENDPOINT must be empty in production (real AWS S3, not MinIO/LocalStack)');

    // --- OpenSearch: if configured, must be TLS + authenticated ---
    if (env.OPENSEARCH_URL) {
      if (!/^https:\/\//.test(env.OPENSEARCH_URL)) p.push('OPENSEARCH_URL must use https in production');
      if (!env.OPENSEARCH_USERNAME || !env.OPENSEARCH_PASSWORD) p.push('OPENSEARCH_USERNAME/PASSWORD required when OpenSearch is configured');
    }

    // --- payments: a real gateway must be wired; its webhook secret must be strong (no sandbox in prod) ---
    if (!env.RAZORPAY_KEY_ID) p.push('RAZORPAY_KEY_ID must be set in production (no sandbox gateway for real money)');
    if (env.RAZORPAY_KEY_ID && weak16(env.RAZORPAY_WEBHOOK_SECRET)) p.push('RAZORPAY_WEBHOOK_SECRET (strong; verifies pay-in webhooks)');
    if (env.RAZORPAYX_KEY_ID && weak16(env.RAZORPAYX_WEBHOOK_SECRET)) p.push('RAZORPAYX_WEBHOOK_SECRET (strong; verifies payout webhooks) required when RazorpayX is configured');
    if (/sandbox-secret/.test(env.SANDBOX_WEBHOOK_SECRET ?? '')) p.push('SANDBOX_WEBHOOK_SECRET must not be the shared default in production');

    // --- external-provider webhook secrets: weak HMAC = forgeable callbacks ---
    if (env.NOTIFY_GATEWAY_URL && weak16(env.NOTIFY_WEBHOOK_SECRET)) p.push('NOTIFY_WEBHOOK_SECRET (strong) required when NOTIFY_GATEWAY_URL is set');
    if (env.MASKING_PROVIDER_URL && weak16(env.MASKING_WEBHOOK_SECRET)) p.push('MASKING_WEBHOOK_SECRET (strong) required when MASKING_PROVIDER_URL is set');

    return p;
  }

  /** Best-effort parse of a postgres URL into {host,user,password,sslDisabled}. Returns null if unparseable. */
  private static tryParsePg(url: string): { host: string; user: string; password: string; sslDisabled: boolean } | null {
    try {
      const u = new URL(url);
      if (!/^postgres(ql)?:$/.test(u.protocol)) return null;
      return {
        host: u.hostname,
        user: decodeURIComponent(u.username),
        password: decodeURIComponent(u.password),
        sslDisabled: /sslmode=disable/i.test(u.search),
      };
    } catch {
      return null;
    }
  }

  get nodeEnv()    { return this.env.NODE_ENV; }
  get port()       { return this.env.PORT; }
  get isProd()     { return this.env.NODE_ENV === 'production'; }
  get shardCount() { return this.env.SHARD_COUNT; }
  get trustProxyHops() { return this.env.TRUST_PROXY_HOPS; }

  get db() {
    return {
      writerUrl: this.env.DATABASE_URL,
      replicaUrl: this.env.DATABASE_REPLICA_URL && this.env.DATABASE_REPLICA_URL.length > 0
        ? this.env.DATABASE_REPLICA_URL : this.env.DATABASE_URL,
      poolMax: this.env.DATABASE_POOL_MAX,
    };
  }
  get redis()  { return { url: this.env.REDIS_URL ?? null }; }
  get search() { return { url: this.env.OPENSEARCH_URL ?? null, username: this.env.OPENSEARCH_USERNAME ?? null, password: this.env.OPENSEARCH_PASSWORD ?? null, indexPrefix: this.env.OPENSEARCH_INDEX_PREFIX }; }
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
  get media() {
    return {
      region: this.env.AWS_REGION,
      bucket: this.env.S3_MEDIA_BUCKET,
      accessKeyId: this.env.S3_ACCESS_KEY_ID,
      secretAccessKey: this.env.S3_SECRET_ACCESS_KEY,
      endpoint: this.env.S3_ENDPOINT ?? null,
      forcePathStyle: this.env.S3_FORCE_PATH_STYLE === 'true',
      presignExpirySec: this.env.S3_PRESIGN_EXPIRY_SEC,
      scanSecret: this.env.MEDIA_SCAN_SECRET,
      maxUploadBytes: this.env.MEDIA_MAX_UPLOAD_BYTES,
    };
  }
  get wallet() { return { grpcUrl: this.env.WALLET_GRPC_URL }; }
  get razorpay(){ return { keyId: this.env.RAZORPAY_KEY_ID, webhookSecret: this.env.RAZORPAY_WEBHOOK_SECRET }; }
  /** Full payments wiring. All env reads for payment gateways live HERE (never process.env in modules). */
  get payments() {
    const isProd = this.env.NODE_ENV === 'production';
    return {
      isProd,
      defaultProvider: this.env.PAYMENTS_DEFAULT_PROVIDER,
      razorpay: {
        keyId: this.env.RAZORPAY_KEY_ID,
        keySecret: this.env.RAZORPAY_KEY_SECRET,
        webhookSecret: this.env.RAZORPAY_WEBHOOK_SECRET,
        baseUrl: this.env.RAZORPAY_BASE_URL ?? undefined,
        configured: this.env.RAZORPAY_KEY_ID.length > 0,
      },
      razorpayx: {
        keyId: this.env.RAZORPAYX_KEY_ID,
        keySecret: this.env.RAZORPAYX_KEY_SECRET,
        accountNumber: this.env.RAZORPAYX_ACCOUNT_NUMBER,
        baseUrl: this.env.RAZORPAYX_BASE_URL ?? undefined,
        webhookSecret: this.env.RAZORPAYX_WEBHOOK_SECRET,
        configured: this.env.RAZORPAYX_KEY_ID.length > 0,
      },
      // Resolved payout-webhook HMAC secret. NEVER falls back to a shared literal in production
      // (so a forged callback can't be accepted on a default secret — fail closed).
      payoutWebhookSecret:
        this.env.RAZORPAYX_WEBHOOK_SECRET || this.env.SANDBOX_WEBHOOK_SECRET || (isProd ? '' : 'sandbox-secret'),
      // Whether the deterministic sandbox gateway may be registered (NON-prod only).
      allowSandbox: !isProd,
    };
  }
  get smsBudgetPaise() { return this.env.SMS_DAILY_BUDGET_PAISE; }
  get notifications() {
    return {
      gatewayUrl: this.env.NOTIFY_GATEWAY_URL || null,   // null ⇒ noop gateway (dev) / drop (prod)
      gatewayApiKey: this.env.NOTIFY_GATEWAY_API_KEY,
      webhookSecret: this.env.NOTIFY_WEBHOOK_SECRET,
    };
  }
  get masking() {
    return {
      providerUrl: this.env.MASKING_PROVIDER_URL || null,   // null ⇒ noop masking provider
      providerApiKey: this.env.MASKING_PROVIDER_API_KEY,
      webhookSecret: this.env.MASKING_WEBHOOK_SECRET,
    };
  }
  get streaming() {
    return {
      providerUrl: this.env.STREAM_PROVIDER_URL || null,    // null ⇒ noop stream provider
      providerApiKey: this.env.STREAM_PROVIDER_API_KEY,
    };
  }
}
