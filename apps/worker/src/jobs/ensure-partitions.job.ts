// apps/worker/src/jobs/ensure-partitions.job.ts · create future partitions (so partitioned inserts never fail)
// and gauge the minimum runway in days for the PartitionRunwayLow alert.
import { Job, JobCtx } from './index';

export const ensurePartitionsJob: Job = {
  name: 'ensure-partitions',
  intervalSec: 3600, // hourly
  async run({ client, metrics }: JobCtx) {
    await client.query('CALL ensure_partitions()');
    const r = await client.query<{ days: string | null }>(
      `SELECT MIN(EXTRACT(EPOCH FROM (to_timestamp(split_part(c.relname,'_p',2),'YYYYMM') + interval '1 month' - now()))/86400)::int AS days
         FROM pg_inherits i JOIN pg_class c ON c.oid = i.inhrelid
        WHERE c.relname ~ '_p[0-9]{6}$'`).catch(() => ({ rows: [{ days: null }] }));
    const days = Number(r.rows[0]?.days ?? 0);
    metrics.setGauge('kv_partition_days_ahead', Number.isFinite(days) ? days : 0);
  },
};
