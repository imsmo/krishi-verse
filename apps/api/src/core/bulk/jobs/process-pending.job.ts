// core/bulk/jobs/process-pending.job.ts · the worker runner that drains pending import jobs (runs in
// apps/worker). It claims pending jobs cross-tenant via the BYPASSRLS kv_relay pool (FOR UPDATE SKIP LOCKED so
// multiple workers don't grab the same job), then hands each to the DI-resolved BulkImportProcessor (which does
// its own per-tenant claim + work). Bounded per run (max). The processor is idempotent, so a crash mid-run is
// safe to retry on the next sweep.
import type { Pool } from 'pg';
import { BulkImportProcessor } from '../csv-import.processor';

export interface ProcessPendingResult { picked: number; }

export async function runPendingImports(relayPool: Pool, processor: BulkImportProcessor, max = 20): Promise<ProcessPendingResult> {
  const r = await relayPool.query(
    `SELECT id, tenant_id FROM bulk_import_jobs WHERE status = 'pending' AND deleted_at IS NULL
      ORDER BY created_at ASC LIMIT $1 FOR UPDATE SKIP LOCKED`, [max]);
  for (const row of r.rows) {
    try { await processor.process(row.tenant_id, row.id); }
    catch { /* the processor records fatal failures on the job; one bad job never stops the sweep */ }
  }
  return { picked: r.rows.length };
}
