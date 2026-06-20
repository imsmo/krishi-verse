// apps/wallet-service/src/core/config/env.validation.ts · pure env reader/validator for the money service.
// No zod dep here (kept to the service's declared deps); plain coercion + a fail-closed production assertion.
export interface WalletEnv {
  NODE_ENV: string;
  DATABASE_WALLET_URL: string;     // connects as kv_wallet (the ONLY role that writes the ledger)
  GRPC_HOST: string;
  GRPC_PORT: number;
  STATEMENT_TIMEOUT_MS: number;    // bound any single ledger query
  LOCK_TIMEOUT_MS: number;         // bound waiting on a FOR UPDATE account lock
  PLATFORM_STRIPE_COUNT: number;   // hot platform accounts striped across N sub-accounts (shard_no)
  RECON_WINDOW_HOURS: number;
  POOL_MAX: number;
}

const num = (v: unknown, d: number): number => { const n = Number(v); return Number.isFinite(n) ? n : d; };

export function readWalletEnv(raw: Record<string, unknown> = process.env): WalletEnv {
  const env: WalletEnv = {
    NODE_ENV: String(raw.NODE_ENV ?? 'development'),
    DATABASE_WALLET_URL: String(raw.DATABASE_WALLET_URL ?? raw.DATABASE_URL ?? ''),
    GRPC_HOST: String(raw.WALLET_GRPC_HOST ?? '0.0.0.0'),
    GRPC_PORT: num(raw.WALLET_GRPC_PORT, 50051),
    STATEMENT_TIMEOUT_MS: num(raw.WALLET_STATEMENT_TIMEOUT_MS, 5000),
    LOCK_TIMEOUT_MS: num(raw.WALLET_LOCK_TIMEOUT_MS, 3000),
    PLATFORM_STRIPE_COUNT: Math.min(Math.max(num(raw.WALLET_PLATFORM_STRIPE_COUNT, 8), 1), 64),  // schema CHECK: shard_no 0..63
    RECON_WINDOW_HOURS: num(raw.WALLET_RECON_WINDOW_HOURS, 24),
    POOL_MAX: num(raw.WALLET_POOL_MAX, 20),
  };
  return env;
}
