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
  constructor(raw: Record<string, unknown> = process.env) { this.env = validateEnv(raw); }

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
  get jwt()    { return { accessSecret: this.env.JWT_ACCESS_SECRET, issuer: this.env.JWT_ISSUER }; }
  get wallet() { return { grpcUrl: this.env.WALLET_GRPC_URL }; }
  get razorpay(){ return { keyId: this.env.RAZORPAY_KEY_ID, webhookSecret: this.env.RAZORPAY_WEBHOOK_SECRET }; }
  get smsBudgetPaise() { return this.env.SMS_DAILY_BUDGET_PAISE; }
}
