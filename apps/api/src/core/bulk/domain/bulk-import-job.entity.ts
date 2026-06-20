// core/bulk/domain/bulk-import-job.entity.ts · a bulk import job (bulk_import_jobs, tenant-scoped). Pure domain.
// Tracks the CSV source (object-store key) + progress counters; status moves ONLY through bulk-import.state.ts
// (Law 5). No version column → the processor locks the row FOR UPDATE while it runs.
import { BulkStatus, DomainEvent, BulkImportEventType } from './bulk-import.events';
import { assertTransition, terminalFor } from './bulk-import.state';

export interface BulkImportJobProps {
  id: string; tenantId: string; importType: string; storageKey: string; originalFilename: string | null;
  status: BulkStatus; totalRows: number; processedRows: number; succeededRows: number; failedRows: number;
  columnMapping: Record<string, string>; requestedBy: string | null; errorSummary: string | null;
  startedAt: Date | null; finishedAt: Date | null; createdAt?: Date;
}
export class BulkImportJob {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: BulkImportJobProps) {}

  static create(input: { id: string; tenantId: string; importType: string; storageKey: string; originalFilename?: string | null; columnMapping?: Record<string, string>; requestedBy: string; }): BulkImportJob {
    const j = new BulkImportJob({ id: input.id, tenantId: input.tenantId, importType: input.importType, storageKey: input.storageKey,
      originalFilename: input.originalFilename ?? null, status: 'pending', totalRows: 0, processedRows: 0, succeededRows: 0, failedRows: 0,
      columnMapping: input.columnMapping ?? {}, requestedBy: input.requestedBy, errorSummary: null, startedAt: null, finishedAt: null });
    j.events.push({ type: BulkImportEventType.Created, payload: { jobId: j.props.id, importType: j.props.importType } });
    return j;
  }
  static rehydrate(p: BulkImportJobProps): BulkImportJob { return new BulkImportJob(p); }

  get id() { return this.props.id; }
  get status() { return this.props.status; }
  get importType() { return this.props.importType; }
  get storageKey() { return this.props.storageKey; }
  get requestedBy() { return this.props.requestedBy; }
  toProps(): Readonly<BulkImportJobProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  begin(totalRows: number, now = new Date()): void {
    assertTransition(this.props.status, 'processing');
    this.props.status = 'processing'; this.props.totalRows = totalRows; this.props.startedAt = now;
  }
  setTotalRows(n: number): void { this.props.totalRows = n; }
  recordProgress(processed: number, succeeded: number, failed: number): void {
    this.props.processedRows = processed; this.props.succeededRows = succeeded; this.props.failedRows = failed;
  }
  finish(now = new Date()): void {
    const to = terminalFor(this.props.succeededRows, this.props.failedRows);
    assertTransition(this.props.status, to);
    this.props.status = to; this.props.finishedAt = now;
    this.events.push({ type: BulkImportEventType.Completed, payload: { jobId: this.props.id, status: to, succeeded: this.props.succeededRows, failed: this.props.failedRows, total: this.props.totalRows } });
  }
  fail(summary: string, now = new Date()): void {
    assertTransition(this.props.status, 'failed');
    this.props.status = 'failed'; this.props.errorSummary = summary.slice(0, 1000); this.props.finishedAt = now;
    this.events.push({ type: BulkImportEventType.Completed, payload: { jobId: this.props.id, status: 'failed', succeeded: this.props.succeededRows, failed: this.props.failedRows } });
  }
  cancel(now = new Date()): void {
    assertTransition(this.props.status, 'cancelled');
    this.props.status = 'cancelled'; this.props.finishedAt = now;
  }
  toJSON() {
    const v = this.props;
    return { id: v.id, importType: v.importType, originalFilename: v.originalFilename, status: v.status,
      totalRows: v.totalRows, processedRows: v.processedRows, succeededRows: v.succeededRows, failedRows: v.failedRows,
      errorSummary: v.errorSummary, startedAt: v.startedAt, finishedAt: v.finishedAt, createdAt: v.createdAt };
  }
}
