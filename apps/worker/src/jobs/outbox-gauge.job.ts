// apps/worker/src/jobs/outbox-gauge.job.ts · gauge the unrelayed outbox backlog for the OutboxBacklogGrowing
// alert. NOTE: the actual relay EXECUTION (running each event's HANDLER) lives in the api modules
// (OutboxHandlerRegistry); invoking those from this standalone worker needs the shared-domain decision (see
// WORKER-RUNTIME.md "Deferred: domain-handler jobs"). This job only MEASURES the backlog.
import { Job, JobCtx } from './index';

export const outboxGaugeJob: Job = {
  name: 'outbox-gauge',
  intervalSec: 60,
  async run({ client, metrics }: JobCtx) {
    const r = await client.query<{ n: string }>(`SELECT count(*)::int AS n FROM outbox_events WHERE status='pending'`);
    metrics.setGauge('kv_outbox_pending', Number(r.rows[0]?.n ?? 0));
  },
};
