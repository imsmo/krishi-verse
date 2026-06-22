// modules/logistics/jobs/village-run-consolidation.job.ts
// Worker job (kv_relay): the signature Saturday Village Run trigger. Once per run-day it emits ONE
// logistics.village_run_due outbox event per active route scheduled for today's weekday (consumed by
// notifications → the route's consolidation point + vehicle driver, "your run is today"). Cross-tenant scan via
// the system pool; bounded. Idempotent per calendar date via an ops_job_runs date-guard so a re-run the same day
// never double-notifies. The emits + the run-marker commit in ONE tx. NOT a DI provider — apps/worker instantiates
// it with the kv_relay pool.
import type { Pool, PoolClient } from 'pg';
import { DeliveryRouteRepository } from '../repositories/delivery-route.repository';
import { ZoneRouteEventType } from '../domain/logistics.events';

const JOB_CODE = 'village_run_consolidation';

export class VillageRunConsolidationJob {
  constructor(private readonly systemPool: Pool, private readonly repo: DeliveryRouteRepository) {}

  /** `now` is injectable for tests; defaults to the current time (UTC weekday/date). */
  async run(limit = 1000, now: Date = new Date()): Promise<{ emitted: number; skipped: boolean }> {
    const weekday = now.getUTCDay();                       // 0=Sun … 6=Sat
    const runDate = now.toISOString().slice(0, 10);        // YYYY-MM-DD
    const client: PoolClient = await this.systemPool.connect();
    try {
      await client.query('BEGIN');
      // date-guard: already consolidated today? (idempotent per calendar date)
      const prior = await client.query(
        `SELECT 1 FROM ops_job_runs WHERE job_code=$1 AND status='completed' AND detail->>'runDate'=$2 LIMIT 1`, [JOB_CODE, runDate]);
      if ((prior.rowCount ?? 0) > 0) { await client.query('ROLLBACK'); return { emitted: 0, skipped: true }; }

      const exec = { query: (sql: string, params?: unknown[]) => client.query(sql, params as any) as any };
      const routes = await this.repo.findActiveByWeekday(exec, weekday, limit);
      for (const r of routes) {
        await client.query(
          `INSERT INTO outbox_events (tenant_id, aggregate_type, aggregate_id, event_type, payload)
           VALUES ($1,'delivery_route',$2,$3,$4::jsonb)`,
          [r.tenantId, r.id, ZoneRouteEventType.VillageRunDue,
           JSON.stringify({ v: 1, routeId: r.id, defaultName: r.defaultName, vehicleId: r.vehicleId, consolidationUserId: r.consolidationUserId, runDate })]);
      }
      await client.query(
        `INSERT INTO ops_job_runs (job_code, status, detail, finished_at) VALUES ($1,'completed',$2::jsonb, now())`,
        [JOB_CODE, JSON.stringify({ runDate, weekday, emitted: routes.length })]);
      await client.query('COMMIT');
      return { emitted: routes.length, skipped: false };
    } catch (e) { await client.query('ROLLBACK').catch(() => undefined); throw e; } finally { client.release(); }
  }
}
