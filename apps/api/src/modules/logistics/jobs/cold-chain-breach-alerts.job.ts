// modules/logistics/jobs/cold-chain-breach-alerts.job.ts
// Worker job (kv_relay): scans NEW cold_chain_logs breach rows (is_breach) across tenants and emits ONE
// logistics.cold_chain_breach outbox event per breach (consumed by notifications → ops/owner alert). cold_chain_logs
// is APPEND-ONLY (no marker column), so dedup uses a high-water-mark in ops_job_runs: each run records the last
// processed (recorded_at, id); the next run resumes strictly after it (keyset). Bounded per tick. The outbox write
// + watermark advance happen in ONE tx so a crash never double-alerts nor skips. NOT a DI provider — apps/worker
// instantiates it with the kv_relay pool.
import type { Pool, PoolClient } from 'pg';
import { ColdChainLogRepository } from '../repositories/cold-chain-log.repository';
import { ZoneRouteEventType } from '../domain/logistics.events';

const JOB_CODE = 'cold_chain_breach_alerts';

export class ColdChainBreachAlertsJob {
  constructor(private readonly systemPool: Pool, private readonly repo: ColdChainLogRepository) {}

  async run(limit = 500): Promise<{ alerted: number }> {
    const client: PoolClient = await this.systemPool.connect();
    try {
      await client.query('BEGIN');
      const exec = { query: (sql: string, params?: unknown[]) => client.query(sql, params as any) as any };

      // resume strictly after the last processed (recorded_at, id)
      const wm = await client.query(
        `SELECT detail->>'watermarkTs' AS ts, detail->>'watermarkId' AS id FROM ops_job_runs
          WHERE job_code=$1 AND status='completed' ORDER BY started_at DESC LIMIT 1`, [JOB_CODE]);
      const after = wm.rows[0]?.ts ? { recordedAt: new Date(wm.rows[0].ts), id: String(wm.rows[0].id) } : null;

      const breaches = await this.repo.findBreachesAfter(exec, after, limit);
      for (const b of breaches) {
        await client.query(
          `INSERT INTO outbox_events (tenant_id, aggregate_type, aggregate_id, event_type, payload)
           VALUES ($1,'cold_chain_log',$2,$3,$4::jsonb)`,
          [b.tenantId, b.subjectId, ZoneRouteEventType.ColdChainBreach,
           JSON.stringify({ v: 1, logId: b.id, subjectType: b.subjectType, subjectId: b.subjectId, tempC: b.tempC, recordedAt: b.recordedAt })]);
      }

      const last = breaches[breaches.length - 1];
      const detail = last
        ? { count: breaches.length, watermarkTs: last.recordedAt instanceof Date ? last.recordedAt.toISOString() : String(last.recordedAt), watermarkId: last.id }
        : { count: 0, ...(after ? { watermarkTs: after.recordedAt.toISOString(), watermarkId: after.id } : {}) };
      await client.query(
        `INSERT INTO ops_job_runs (job_code, status, detail, finished_at) VALUES ($1,'completed',$2::jsonb, now())`,
        [JOB_CODE, JSON.stringify(detail)]);

      await client.query('COMMIT');
      return { alerted: breaches.length };
    } catch (e) { await client.query('ROLLBACK').catch(() => undefined); throw e; } finally { client.release(); }
  }
}
