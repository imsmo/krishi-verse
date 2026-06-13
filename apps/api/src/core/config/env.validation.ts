// apps/api/src/core/config/env.validation.ts · validates EVERY env var at
// boot — a missing/invalid variable crashes the pod at startup (loudly),
// never at 2 AM mid-request. Add every new variable HERE first.
import { z } from 'zod';

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_MAX: z.coerce.number().min(1).max(100).default(20),
  REDIS_URL: z.string().url(),
  OPENSEARCH_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(16),
  WALLET_GRPC_URL: z.string(),
  AWS_REGION: z.string().default('ap-south-1'),
  S3_MEDIA_BUCKET: z.string(),
  RAZORPAY_KEY_ID: z.string(),
  RAZORPAY_WEBHOOK_SECRET: z.string(),
  MSG91_AUTH_KEY: z.string(),
  SMS_DAILY_BUDGET_PAISE: z.coerce.number().positive(),
  // ...every other variable from .env.example gets a line here
});

export type Env = z.infer<typeof EnvSchema>;
export const validateEnv = (cfg: Record<string, unknown>): Env => EnvSchema.parse(cfg);
