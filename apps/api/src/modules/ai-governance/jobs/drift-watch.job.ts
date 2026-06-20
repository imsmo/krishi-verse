// modules/ai-governance/jobs/drift-watch.job.ts · the worker's model-drift watcher.
// Connected as the BYPASSRLS relay role (it must see every tenant's inferences), it scans the last 24h of the
// inference audit log per model and, where the human-override rate breaches a threshold over a minimum sample,
// enqueues ONE 'drift' review against that model's most recent inference (carrying that inference's tenant_id
// so the tenant's reviewer can pick it up). Idempotent (skips models that already have an open drift item on
// that inference) and bounded per run (LIMIT) — no write amplification.
import type { Pool } from 'pg';

export interface DriftWatchResult { enqueued: number; }

export async function runDriftWatch(relayPool: Pool, opts: { minSample?: number; overrideRate?: number; max?: number } = {}): Promise<DriftWatchResult> {
  const minSample = opts.minSample ?? 20;
  const overrideRate = opts.overrideRate ?? 0.2;          // ≥20% of recent decisions corrected by humans → drift
  const max = opts.max ?? 200;
  const r = await relayPool.query(
    `WITH drift AS (
       SELECT i.model_id, count(*) AS n, count(*) FILTER (WHERE i.was_overridden) AS overridden
       FROM ai_inferences i
       WHERE i.created_at >= now() - interval '1 day'
       GROUP BY i.model_id
       HAVING count(*) >= $2 AND (count(*) FILTER (WHERE i.was_overridden))::numeric / count(*) >= $3
     ),
     latest AS (
       SELECT DISTINCT ON (i.model_id) i.id, i.created_at, i.tenant_id, i.model_id
       FROM ai_inferences i JOIN drift d ON d.model_id = i.model_id
       WHERE i.created_at >= now() - interval '1 day'
       ORDER BY i.model_id, i.created_at DESC, i.id DESC
     )
     INSERT INTO ai_review_queue (tenant_id, inference_id, inference_created_at, queue_kind, priority, status)
     SELECT l.tenant_id, l.id, l.created_at, 'drift', 20, 'pending'
     FROM latest l
     WHERE NOT EXISTS (SELECT 1 FROM ai_review_queue q WHERE q.inference_id = l.id AND q.queue_kind = 'drift')
     LIMIT $1
     RETURNING id`,
    [max, minSample, overrideRate]);
  return { enqueued: r.rowCount ?? 0 };
}
