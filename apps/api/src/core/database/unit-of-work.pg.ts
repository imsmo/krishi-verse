// core/database/unit-of-work.pg.ts
// Concrete UnitOfWork (Postgres). For EVERY write it:
//   1. routes to the tenant's shard writer pool (ShardRouter),
//   2. opens ONE transaction,
//   3. sets app.tenant_id + app.user_id as LOCAL GUCs so RLS isolates the tenant
//      for the whole tx (defense-in-depth on top of app-level tenant filters),
//   4. runs the callback with a TxContext (the OutboxWriter shares this same tx,
//      so events can never be dual-written or lost — Law 4),
//   5. COMMITs; on a serialization failure (40001) or deadlock (40P01) it ROLLS
//      BACK and retries with jittered backoff (safe at billions of writes).
import { Injectable, Logger } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { UnitOfWork, TxContext } from './unit-of-work';
import { PgPoolProvider } from './pg-pool.provider';
import { ShardRouter } from '../sharding/shard-router';
import { Limits } from '../../shared/constants/limits';

const RETRYABLE = new Set(['40001', '40P01']); // serialization_failure, deadlock_detected

@Injectable()
export class PgUnitOfWork extends UnitOfWork {
  private readonly log = new Logger(PgUnitOfWork.name);
  constructor(private readonly pools: PgPoolProvider, private readonly shards: ShardRouter) { super(); }

  async run<T>(tenantId: string, fn: (tx: TxContext) => Promise<T>, opts?: { userId?: string; retries?: number }): Promise<T> {
    const shardId = this.shards.shardFor(tenantId);
    const pool: Pool = this.pools.writer(shardId);
    const maxRetries = opts?.retries ?? Limits.UOW_MAX_RETRIES;

    for (let attempt = 0; ; attempt++) {
      const client: PoolClient = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);
        await client.query(`SELECT set_config('app.user_id', $1, true)`, [opts?.userId ?? '']);
        const tx: TxContext = {
          tenantId, userId: opts?.userId,
          query: async <R = any>(sql: string, params?: readonly unknown[]) => {
            const r = await client.query(sql, params as unknown[]);
            return { rows: r.rows as R[], rowCount: r.rowCount ?? 0 };
          },
        };
        const result = await fn(tx);
        await client.query('COMMIT');
        return result;
      } catch (err: any) {
        await client.query('ROLLBACK').catch(() => undefined);
        if (RETRYABLE.has(err?.code) && attempt < maxRetries) {
          const backoff = Math.min(50 * 2 ** attempt, 500) + Math.floor(Math.random() * 25);
          this.log.warn(`tx retry ${attempt + 1}/${maxRetries} (pg ${err.code}) after ${backoff}ms`);
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }
        throw err;
      } finally {
        client.release();
      }
    }
  }
}
