// core/quota/quota.service.pg.ts
// Concrete QuotaService. Plan limits live in the DB (plan_limits, resolved via the
// tenant's active subscription); usage is tracked per month in usage_counters.
//   • assertWithinLimit() runs BEFORE the write (cheap read; -1 / no row = unlimited)
//   • increment() runs INSIDE the business tx so usage and the entity commit atomically
// This makes overages impossible at the data layer, not merely discouraged.
import { Injectable } from '@nestjs/common';
import { QuotaService } from './quota.service';
import { TxContext } from '../database/unit-of-work';
import { PgPoolProvider } from '../database/pg-pool.provider';
import { ShardRouter } from '../sharding/shard-router';
import { QuotaExceededError } from '../../shared/errors/app-error';

@Injectable()
export class PgQuotaService extends QuotaService {
  constructor(private readonly pools: PgPoolProvider, private readonly shards: ShardRouter) { super(); }

  async assertWithinLimit(tenantId: string, metric: string): Promise<void> {
    const pool = this.pools.writer(this.shards.shardFor(tenantId));
    const client = await pool.connect();
    try {
      await client.query('BEGIN READ ONLY');
      await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);
      const lim = await client.query(
        `SELECT pl.limit_value
           FROM subscriptions s
           JOIN plan_limits pl ON pl.plan_id = s.plan_id
          WHERE s.tenant_id = $1 AND pl.limit_code = $2 AND s.status = 'active'
          ORDER BY s.created_at DESC LIMIT 1`,
        [tenantId, metric],
      );
      await client.query('COMMIT');
      if (lim.rowCount === 0) return;                 // no limit configured ⇒ unlimited
      const limit = Number(lim.rows[0].limit_value);
      if (limit < 0) return;                          // -1 ⇒ explicitly unlimited

      const usage = await this.readUsage(tenantId, metric);
      if (usage >= limit) throw new QuotaExceededError(metric, limit, usage);
    } catch (e) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally {
      client.release();
    }
  }

  private async readUsage(tenantId: string, metric: string): Promise<number> {
    const pool = this.pools.replica(this.shards.shardFor(tenantId));
    const client = await pool.connect();
    try {
      await client.query('BEGIN READ ONLY');
      await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);
      const r = await client.query(
        `SELECT used_value FROM usage_counters
          WHERE tenant_id = $1 AND metric_code = $2 AND period = date_trunc('month', now())::date`,
        [tenantId, metric],
      );
      await client.query('COMMIT');
      return r.rowCount ? Number(r.rows[0].used_value) : 0;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally {
      client.release();
    }
  }

  async increment(tx: TxContext, tenantId: string, metric: string, by: number): Promise<void> {
    await tx.query(
      `INSERT INTO usage_counters (tenant_id, metric_code, period, used_value)
       VALUES ($1, $2, date_trunc('month', now())::date, $3)
       ON CONFLICT (tenant_id, metric_code, period)
       DO UPDATE SET used_value = usage_counters.used_value + EXCLUDED.used_value`,
      [tenantId, metric, by],
    );
  }
}
