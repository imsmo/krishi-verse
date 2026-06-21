// apps/stream-processor/src/db.ts · the Postgres pool. The stream-processor connects as the kv_relay BYPASSRLS
// role (migration 0018) because it tails the outbox + records the idempotency ledger ACROSS every tenant —
// exactly like the in-process relay. It still writes tenant_id on every row (audit/partition-pruning) and any
// tenant-scoped WRITE it performs (projections) sets app.tenant_id first so RLS holds as defense-in-depth.
import { Pool, PoolClient } from 'pg';

export class Db {
  readonly pool: Pool;
  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 10,
      statement_timeout: 10_000,        // bound every statement (§5)
      query_timeout: 10_000,
      idleTimeoutMillis: 30_000,
    });
  }

  query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }> {
    return this.pool.query(sql, params as unknown[]) as unknown as Promise<{ rows: T[]; rowCount: number | null }>;
  }

  /** Run `fn` inside a tx with app.tenant_id set, so any tenant-scoped write is RLS-correct. */
  async withTenantTx<T>(tenantId: string | null, fn: (c: PoolClient) => Promise<T>): Promise<T> {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      await c.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId ?? '']);
      const out = await fn(c);
      await c.query('COMMIT');
      return out;
    } catch (e) {
      await c.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally {
      c.release();
    }
  }

  async close(): Promise<void> { await this.pool.end().catch(() => undefined); }
}
