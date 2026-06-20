// apps/wallet-service/src/core/database/pg-pool.provider.ts · the dedicated pg pool for the money service,
// connected as kv_wallet — the ONLY DB role permitted to write wallet_accounts + ledger_* (Law 2). Every
// connection sets a bounded statement_timeout + lock_timeout so a stuck money query can never hang forever (a
// money op MUST fail loudly, never wedge — §4 / Law 12). withTx() runs a callback in ONE ACID transaction.
import { Pool, PoolClient } from 'pg';
import { WalletConfig } from '../config/wallet-config';

/** Minimal query surface the ledger code depends on (a PoolClient satisfies it). */
export interface Tx { query<T = any>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>; }

export class WalletPool {
  private readonly pool: Pool;
  constructor(private readonly config: WalletConfig) {
    const e = config.env;
    this.pool = new Pool({ connectionString: e.DATABASE_WALLET_URL, max: e.POOL_MAX, application_name: 'kv-wallet-service' });
    this.pool.on('connect', (c) => {
      void c.query(`SET statement_timeout = ${e.STATEMENT_TIMEOUT_MS}; SET lock_timeout = ${e.LOCK_TIMEOUT_MS};`);
    });
  }
  query<T = any>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }> {
    return this.pool.query(sql, params as any[]) as unknown as Promise<{ rows: T[]; rowCount: number | null }>;
  }

  async withTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const out = await fn(client as unknown as Tx);
      await client.query('COMMIT');
      return out;
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch { /* connection already broken */ }
      throw e;
    } finally {
      client.release();
    }
  }
  async end(): Promise<void> { await this.pool.end(); }
}
