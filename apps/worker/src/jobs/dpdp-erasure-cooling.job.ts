// apps/worker/src/jobs/dpdp-erasure-cooling.job.ts · advance erasure DSRs whose 90-day cooling-off has elapsed to
// 'in_progress' and emit identity.erasure_ready to the outbox so the erasure pipeline runs. kv_relay (BYPASSRLS)
// sees every tenant. Mirrors the api job's SQL; writes the outbox row in the same statement scope.
import { Job, JobCtx } from './index';

export const dpdpErasureCoolingJob: Job = {
  name: 'dpdp-erasure-cooling',
  intervalSec: 3600, // hourly
  async run({ client, metrics }: JobCtx) {
    // data_subject_requests is keyed by user_id and has NO tenant_id column (users are global; tenant membership
    // lives in user_tenant_roles). Resolve the subject's tenant for the outbox row via their active membership
    // (any one — erasure is global to the user; outbox_events.tenant_id is nullable, so NULL is acceptable when the
    // user has no active membership).
    const due = await client.query<{ id: string; user_id: string; tenant_id: string | null }>(
      `UPDATE data_subject_requests SET status='in_progress', updated_at=now()
        WHERE request_type='erasure' AND status='open'
          AND cooling_ends_at IS NOT NULL AND cooling_ends_at <= now()
        RETURNING id, user_id,
          (SELECT utr.tenant_id FROM user_tenant_roles utr
            WHERE utr.user_id = data_subject_requests.user_id AND utr.is_active AND utr.deleted_at IS NULL
            ORDER BY utr.created_at LIMIT 1) AS tenant_id`);
    for (const r of due.rows) {
      await client.query(
        `INSERT INTO outbox_events (id, tenant_id, aggregate_type, aggregate_id, event_type, payload, status, created_at)
         VALUES (uuid_generate_v7(), $1, 'user', $2, 'identity.erasure_ready', $3::jsonb, 'pending', now())`,
        [r.tenant_id, r.user_id, JSON.stringify({ v: 1, dsrId: r.id, userId: r.user_id })]);
    }
    metrics.inc('kv_erasure_advanced_total', undefined, due.rowCount ?? 0);
  },
};
