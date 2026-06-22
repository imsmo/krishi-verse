// modules/payments/jobs/payout-queue-monitor.job.ts
// Worker job (kv_relay/kv_wallet): a liveness probe over the payout pipeline. Money waiting too long
// is a real customer-harm signal — a payout stuck 'queued' (the execution worker isn't draining) or
// 'processing' (the gateway never confirmed via webhook) past its SLA must page ops, not rot silently.
// Counts the backlog across tenants (payouts is queried on the privileged worker connection — it spans
// tenants by design) and records the snapshot in ops_job_runs so the trend is observable. Read-only:
// it MOVES NO MONEY and changes no payout — it only OBSERVES + records. NOT a DI provider; apps/worker
// instantiates it with the privileged Pool.
import type { Pool, PoolClient } from 'pg';

const JOB_CODE = 'payout_queue_monitor';

export interface QueueHealth { queuedStuck: number; processingStuck: number; oldestQueuedMins: number; alert: boolean; }

export class PayoutQueueMonitorJob {
  constructor(private readonly systemPool: Pool) {}

  /** `queuedSlaMins` — a queued payout older than this means the executor is behind.
   *  `processingSlaMins` — a processing payout older than this means the gateway never confirmed. */
  async run(queuedSlaMins = 15, processingSlaMins = 120): Promise<QueueHealth> {
    const client: PoolClient = await this.systemPool.connect();
    try {
      const r = await client.query<{ queued_stuck: string; processing_stuck: string; oldest_queued_mins: string | null }>(
        `SELECT
           count(*) FILTER (WHERE status='queued'     AND created_at < now() - ($1 || ' minutes')::interval)::text AS queued_stuck,
           count(*) FILTER (WHERE status='processing' AND created_at < now() - ($2 || ' minutes')::interval)::text AS processing_stuck,
           COALESCE(EXTRACT(EPOCH FROM (now() - min(created_at) FILTER (WHERE status='queued')))/60, 0)::int::text AS oldest_queued_mins
         FROM payouts WHERE status IN ('queued','processing')`,
        [String(queuedSlaMins), String(processingSlaMins)]);
      const queuedStuck = Number(r.rows[0]?.queued_stuck ?? 0);
      const processingStuck = Number(r.rows[0]?.processing_stuck ?? 0);
      const oldestQueuedMins = Number(r.rows[0]?.oldest_queued_mins ?? 0);
      const alert = queuedStuck > 0 || processingStuck > 0;
      await client.query(
        `INSERT INTO ops_job_runs (job_code, status, detail, finished_at) VALUES ($1, 'completed', $2::jsonb, now())`,
        [JOB_CODE, JSON.stringify({ queuedStuck, processingStuck, oldestQueuedMins, alert })]);
      return { queuedStuck, processingStuck, oldestQueuedMins, alert };
    } finally {
      client.release();
    }
  }
}
