// modules/ai-governance/jobs/fairness-audit-monthly.job.ts · the worker's monthly fairness/health audit.
// Connected as the BYPASSRLS relay role (ai_models is GLOBAL; inferences span all tenants), it rolls up the
// last 30 days of the inference audit log per model into ai_models.fairness_audit (total / overridden /
// low-confidence counts + the window). Bounded by the number of registered models; idempotent (an overwrite of
// the same jsonb summary). This is the data the registry surfaces for governance review.
import type { Pool } from 'pg';

export interface FairnessAuditResult { models: number; }

export async function runFairnessAudit(relayPool: Pool): Promise<FairnessAuditResult> {
  const r = await relayPool.query(
    `UPDATE ai_models m
        SET fairness_audit = sub.audit, updated_at = now()
       FROM (
         SELECT i.model_id,
                jsonb_build_object(
                  'window', '30d',
                  'generatedAt', now(),
                  'total', count(*),
                  'overridden', count(*) FILTER (WHERE i.was_overridden),
                  'lowConfidence', count(*) FILTER (WHERE i.confidence IS NOT NULL AND i.confidence < 0.5),
                  'overrideRate', round((count(*) FILTER (WHERE i.was_overridden))::numeric / greatest(count(*), 1), 4)
                ) AS audit
         FROM ai_inferences i
         WHERE i.created_at >= now() - interval '30 days'
         GROUP BY i.model_id
       ) sub
      WHERE m.id = sub.model_id AND m.deleted_at IS NULL`);
  return { models: r.rowCount ?? 0 };
}
