// core/search/jobs/reindex.job.ts · the bulk backfill / disaster-recovery reindexer (runs in apps/worker on the
// privileged kv_relay pool so it scans every tenant's rows; each doc carries its tenant_id so the read path
// re-isolates). KEYSET-paginated over (timeCol, idCol) — never OFFSET (Law 5) — and BOUNDED: each run processes
// at most maxDocs in batches of batchSize, so a reindex can't run away. Idempotent: bulk index by id, so a
// re-run just overwrites. Use to populate a fresh index or rebuild after a mapping change.
import type { Pool } from 'pg';
import { OpenSearchTransport, BulkOp } from '../opensearch.transport';
import { IndexDef } from '../indices/index-def';

export interface ReindexResult { index: string; indexed: number; done: boolean; }

export async function runReindex(relayPool: Pool, transport: OpenSearchTransport, def: IndexDef, opts: { batchSize?: number; maxDocs?: number } = {}): Promise<ReindexResult> {
  const batchSize = Math.min(Math.max(opts.batchSize ?? 500, 1), 2000);
  const maxDocs = opts.maxDocs ?? 100_000;
  const { table, idCol, timeCol, indexableWhere } = def.source;

  await transport.ensureIndex(def.logical, def.body);
  let cursorTime: string | null = null; let cursorId: string | null = null; let indexed = 0;

  while (indexed < maxDocs) {
    const params: unknown[] = [];
    let where = indexableWhere;
    if (cursorTime != null && cursorId != null) {
      where += ` AND (${timeCol} > $1 OR (${timeCol} = $1 AND ${idCol} > $2))`;
      params.push(cursorTime, cursorId);
    }
    const limit = Math.min(batchSize, maxDocs - indexed);
    const sql = `SELECT * FROM ${table} WHERE ${where} ORDER BY ${timeCol} ASC, ${idCol} ASC LIMIT ${limit}`;
    const r = await relayPool.query(sql, params);
    if (r.rows.length === 0) return { index: def.logical, indexed, done: true };

    const ops: BulkOp[] = r.rows.map((row) => { const { id, doc } = def.project(row); return { id, doc }; });
    await transport.bulk(def.logical, ops);
    indexed += r.rows.length;

    const last = r.rows[r.rows.length - 1];
    cursorTime = last[timeCol] instanceof Date ? last[timeCol].toISOString() : last[timeCol];
    cursorId = String(last[idCol]);
    if (r.rows.length < limit) return { index: def.logical, indexed, done: true };
  }
  return { index: def.logical, indexed, done: false };   // hit maxDocs — caller re-runs to continue
}
