// apps/worker/src/db.ts · pg pool (kv_relay, BYPASSRLS) + a withClient helper that sets a bounded statement
// timeout so a runaway job can't hold a connection forever.
import { Pool, PoolClient } from 'pg';
import { WorkerConfig } from './config';

export function makePool(cfg: WorkerConfig): Pool {
  return new Pool({ connectionString: cfg.env.DATABASE_URL, max: 8, application_name: 'kv-worker' });
}

export async function withClient<T>(pool: Pool, statementTimeoutMs: number, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query(`SET statement_timeout = ${Math.trunc(statementTimeoutMs)}`);
    return await fn(c);
  } finally {
    c.release();
  }
}
