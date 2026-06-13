// apps/api/src/core/config/app-config.ts · the ONLY place process.env is
// read. Everywhere else injects AppConfig — typed, validated, mockable.
// Rule of thumb for "where does config go":
//   infrastructure values (URLs, keys, pools)  → env vars / Secrets Manager (here)
//   business values (commission %, languages…) → DATABASE tables (tenant_settings,
//   commission_rules, plans…) — NEVER env vars, because admins manage them.
import { validateEnv, Env } from './env.validation';

export class AppConfig {
  private readonly env: Env;
  constructor() { this.env = validateEnv(process.env); }
  get db()      { return { url: this.env.DATABASE_URL, poolMax: this.env.DATABASE_POOL_MAX }; }
  get redis()   { return { url: this.env.REDIS_URL }; }
  get search()  { return { url: this.env.OPENSEARCH_URL }; }
  get wallet()  { return { grpcUrl: this.env.WALLET_GRPC_URL }; }
  get razorpay(){ return { keyId: this.env.RAZORPAY_KEY_ID, webhookSecret: this.env.RAZORPAY_WEBHOOK_SECRET }; }
  get smsBudgetPaise() { return this.env.SMS_DAILY_BUDGET_PAISE; }
  get isProd()  { return this.env.NODE_ENV === 'production'; }
}
