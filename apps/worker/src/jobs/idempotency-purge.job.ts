// apps/worker/src/jobs/idempotency-purge.job.ts · drop expired idempotency keys (bounded batch) to keep the hot
// table small. Idempotent + safe; keys past expires_at are no longer needed.
import { Job, JobCtx } from './index';

export const idempotencyPurgeJob: Job = {
  name: 'idempotency-purge',
  intervalSec: 3600, // hourly
  async run({ client, metrics }: JobCtx) {
    const res = await client.query(
      `DELETE FROM idempotency_keys WHERE ctid IN (
         SELECT ctid FROM idempotency_keys WHERE expires_at < now() LIMIT 10000)`);
    metrics.inc('kv_idempotency_purged_total', undefined, res.rowCount ?? 0);
  },
};
