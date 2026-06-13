// core/config/env.validation.ts
// Validates EVERY env var at boot — a missing/invalid variable crashes the pod
// at startup (loudly), never at 2 AM mid-request. Add every new variable HERE
// first. Infra essentials are required; integrations default to empty so the
// API can boot for the listings slice without the whole platform configured.
import { z } from 'zod';

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),

  // --- data stores (required) ---
  DATABASE_URL: z.string().min(1),
  DATABASE_REPLICA_URL: z.string().optional(),          // defaults to DATABASE_URL
  DATABASE_POOL_MAX: z.coerce.number().min(1).max(200).default(20),
  SHARD_COUNT: z.coerce.number().min(1).max(4096).default(1),

  // --- auth (required) ---
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_ISSUER: z.string().default('krishi-verse'),

  // --- optional infra / integrations (empty-safe defaults) ---
  REDIS_URL: z.string().optional(),                     // absent ⇒ in-memory cache
  OPENSEARCH_URL: z.string().optional(),                // absent ⇒ replica-backed search
  WALLET_GRPC_URL: z.string().default(''),
  AWS_REGION: z.string().default('ap-south-1'),
  S3_MEDIA_BUCKET: z.string().default(''),
  RAZORPAY_KEY_ID: z.string().default(''),
  RAZORPAY_WEBHOOK_SECRET: z.string().default(''),
  MSG91_AUTH_KEY: z.string().default(''),
  SMS_DAILY_BUDGET_PAISE: z.coerce.number().nonnegative().default(0),
});

export type Env = z.infer<typeof EnvSchema>;
export const validateEnv = (cfg: Record<string, unknown>): Env => EnvSchema.parse(cfg);
