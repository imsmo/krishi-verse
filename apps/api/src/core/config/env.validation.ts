// core/config/env.validation.ts
// Validates EVERY env var at boot — a missing/invalid variable crashes the pod
// at startup (loudly), never at 2 AM mid-request. Add every new variable HERE
// first. Infra essentials are required; integrations default to empty so the
// API can boot for the listings slice without the whole platform configured.
import { z } from 'zod';

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(1), // # of trusted proxies/LB hops in front of the API

  // --- data stores (required) ---
  DATABASE_URL: z.string().min(1),
  DATABASE_REPLICA_URL: z.string().optional(),          // defaults to DATABASE_URL
  DATABASE_POOL_MAX: z.coerce.number().min(1).max(200).default(20),
  SHARD_COUNT: z.coerce.number().min(1).max(4096).default(1),

  // --- auth (required) ---
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_ISSUER: z.string().default('krishi-verse'),
  JWT_AUDIENCE: z.string().default('krishi-verse-api'),
  JWT_REFRESH_SECRET: z.string().min(16).default('dev-refresh-secret-change-me-32x'),
  JWT_ACCESS_TTL_SEC: z.coerce.number().int().positive().default(900),        // 15 min
  JWT_REFRESH_TTL_SEC: z.coerce.number().int().positive().default(2592000),   // 30 days
  AUTH_HASH_PEPPER: z.string().min(16).default('dev-pepper-change-me-min-32-chars!'),
  OTP_TTL_SEC: z.coerce.number().int().positive().default(300),               // 5 min
  OTP_LENGTH: z.coerce.number().int().min(4).max(8).default(6),
  OTP_MAX_VERIFY_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OTP_REQUEST_MAX_PER_HOUR: z.coerce.number().int().positive().default(5),
  OTP_RESEND_COOLDOWN_SEC: z.coerce.number().int().nonnegative().default(30),
  OTP_VERIFY_MAX_PER_HOUR: z.coerce.number().int().positive().default(30),
  // Whether /auth/otp may return the code in its response. MUST be false in prod
  // (AppConfig fails boot if true in production). Defaults to true only under test.
  AUTH_EXPOSE_OTP: z.enum(['true', 'false']).optional(),

  // --- optional infra / integrations (empty-safe defaults) ---
  REDIS_URL: z.string().optional(),                     // absent ⇒ in-memory cache
  OPENSEARCH_URL: z.string().optional(),                // absent ⇒ replica-backed search
  WALLET_GRPC_URL: z.string().default(''),
  AWS_REGION: z.string().default('ap-south-1'),
  S3_MEDIA_BUCKET: z.string().default(''),
  S3_ACCESS_KEY_ID: z.string().default(''),             // empty ⇒ use the instance IAM role (no static keys)
  S3_SECRET_ACCESS_KEY: z.string().default(''),
  S3_ENDPOINT: z.string().optional(),                   // set for MinIO/LocalStack; absent ⇒ AWS S3
  S3_FORCE_PATH_STYLE: z.enum(['true', 'false']).optional(),  // MinIO needs path-style addressing
  S3_PRESIGN_EXPIRY_SEC: z.coerce.number().int().positive().max(604800).default(900), // 15 min (max 7d)
  MEDIA_SCAN_SECRET: z.string().default(''),            // HMAC secret for the AV scan-result webhook
  MEDIA_MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(52428800), // 50 MiB default cap
  RAZORPAY_KEY_ID: z.string().default(''),
  RAZORPAY_WEBHOOK_SECRET: z.string().default(''),
  MSG91_AUTH_KEY: z.string().default(''),
  SMS_DAILY_BUDGET_PAISE: z.coerce.number().nonnegative().default(0),
  NOTIFY_GATEWAY_URL: z.string().default(''),           // external notification product base URL; absent ⇒ noop gateway
  NOTIFY_GATEWAY_API_KEY: z.string().default(''),
  NOTIFY_WEBHOOK_SECRET: z.string().default(''),        // HMAC secret for the delivery-status callback
  MASKING_PROVIDER_URL: z.string().default(''),         // external number-masking telephony provider; absent ⇒ noop
  MASKING_PROVIDER_API_KEY: z.string().default(''),
  MASKING_WEBHOOK_SECRET: z.string().default(''),       // HMAC secret for the call-status callback
  STREAM_PROVIDER_URL: z.string().default(''),          // external live-streaming provider; absent ⇒ noop
  STREAM_PROVIDER_API_KEY: z.string().default(''),
});

export type Env = z.infer<typeof EnvSchema>;
export const validateEnv = (cfg: Record<string, unknown>): Env => EnvSchema.parse(cfg);
