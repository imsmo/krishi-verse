// apps/worker/src/jobs/retention-enforcer.job.ts · DPDP storage-limitation. For each ACTIVE policy with
// action='delete', purge rows older than active_months from that table (bounded batch). Table names come from the
// policy row but are STILL validated against the catalog + required to have a created_at column (no injection,
// no purging a table that lacks the time column). 'anonymise'/'archive' actions are left to their dedicated
// pipelines (flagged) — we never silently mis-handle them.
import { Job, JobCtx } from './index';

export const retentionEnforcerJob: Job = {
  name: 'retention-enforcer',
  intervalSec: 86400, // daily
  async run({ client, metrics }: JobCtx) {
    const policies = await client.query<{ table_name: string; active_months: number; action: string }>(
      `SELECT table_name, active_months, action FROM data_retention_policies WHERE is_active = true AND action = 'delete'`);
    let purged = 0;
    for (const p of policies.rows) {
      // validate the identifier against the catalog + require a created_at column (defence in depth)
      const chk = await client.query<{ ok: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name=$1 AND column_name='created_at') AS ok`, [p.table_name]);
      if (!chk.rows[0]?.ok) { metrics.inc('kv_retention_skipped', { table: p.table_name }); continue; }
      // identifier is catalog-verified → safe to interpolate; delete in a bounded batch
      const res = await client.query(
        `DELETE FROM "${p.table_name}" WHERE ctid IN (
           SELECT ctid FROM "${p.table_name}"
            WHERE created_at < now() - ($1 || ' months')::interval
            LIMIT 5000)`, [String(p.active_months)]);
      purged += res.rowCount ?? 0;
    }
    metrics.inc('kv_retention_purged_total', undefined, purged);
  },
};
