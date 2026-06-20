// core/bulk/bulk-result.store.ts · per-row failure log (bulk_import_errors). Append-only, tenant-scoped + RLS.
// CAPPED per job (the processor stops recording past MAX_RECORDED_ERRORS) so a 1M-row garbage CSV can't write a
// million error rows (§4 write-amplification). The failed-row COUNT on the job stays accurate beyond the cap.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../database/read-replica.provider';
import { TxContext } from '../database/unit-of-work';

export const MAX_RECORDED_ERRORS = 1000;

export interface RowError { tenantId: string; jobId: string; rowIndex: number; errorCode: string; errorMessage: string; raw?: Record<string, unknown> | null; }

@Injectable()
export class BulkResultStore {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  /** Record one row failure in the caller's tx (truncates the raw row + message to bound size). */
  async recordError(tx: TxContext, e: RowError): Promise<void> {
    await tx.query(
      `INSERT INTO bulk_import_errors (tenant_id, job_id, row_index, error_code, error_message, raw)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [e.tenantId, e.jobId, e.rowIndex, e.errorCode.slice(0, 60), (e.errorMessage ?? '').slice(0, 1000), e.raw ? JSON.stringify(e.raw).slice(0, 4000) : null]);
  }
  /** List a job's recorded errors, keyset on row_index ASC (never OFFSET). Tenant-scoped. */
  async listErrors(tenantId: string, jobId: string, q: { afterRow?: number; limit: number }): Promise<Array<{ rowIndex: number; errorCode: string; errorMessage: string; raw: unknown }>> {
    const params: unknown[] = [tenantId, jobId]; let where = `tenant_id=$1 AND job_id=$2`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.afterRow != null) where += ` AND row_index > ${p(q.afterRow)}`;
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(
      `SELECT row_index, error_code, error_message, raw FROM bulk_import_errors WHERE ${where} ORDER BY row_index ASC LIMIT ${lp}`, params);
    return r.rows.map((row: any) => ({ rowIndex: row.row_index, errorCode: row.error_code, errorMessage: row.error_message, raw: row.raw ?? null }));
  }
}
