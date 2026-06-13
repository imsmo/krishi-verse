// core/database/read-replica.pg.ts
// Concrete ReadReplicaProvider. Read paths (CQRS, Law 12) run on the tenant's
// shard REPLICA, never the write primary. Each query runs inside a tiny
// read-only transaction that sets app.tenant_id LOCAL so RLS isolates the
// tenant even on the replica (the SELECT can never leak another tenant's rows).
import { Injectable } from '@nestjs/common';
import { ReadReplicaProvider } from './read-replica.provider';
import { SqlExecutor } from './unit-of-work';
import { PgPoolProvider } from './pg-pool.provider';
import { ShardRouter } from '../sharding/shard-router';

@Injectable()
export class PgReadReplicaProvider extends ReadReplicaProvider {
  constructor(private readonly pools: PgPoolProvider, private readonly shards: ShardRouter) { super(); }

  forTenant(tenantId: string): SqlExecutor {
    const shardId = this.shards.shardFor(tenantId);
    const pool = this.pools.replica(shardId);
    return {
      query: async <T = any>(sql: string, params?: readonly unknown[]) => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN READ ONLY');
          await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);
          const r = await client.query(sql, params as unknown[]);
          await client.query('COMMIT');
          return { rows: r.rows as T[], rowCount: r.rowCount ?? 0 };
        } catch (e) {
          await client.query('ROLLBACK').catch(() => undefined);
          throw e;
        } finally {
          client.release();
        }
      },
    };
  }
}
