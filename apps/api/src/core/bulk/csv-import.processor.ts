// core/bulk/csv-import.processor.ts · the engine that turns a pending job into applied rows. Runs in apps/worker
// (off the queue) or on-demand. Flow: CLAIM the job (pending→processing, FOR UPDATE so two workers can't both
// run it) → fetch the CSV from the object store (resilience-wrapped) → parse (bounded) → validate the applier's
// required columns (fail the whole job if missing) → apply each row through the registered applier with a
// DETERMINISTIC per-row idempotency key (so a re-run never double-creates) → record per-row failures (capped) →
// finish (completed / partially_completed / failed). Each row-apply runs in the applier's OWN tx (no nesting);
// progress + error writes are their own short txs. Bounded throughout (Law 5/12).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../outbox/outbox.writer';
import { METRICS, Metrics, timed } from '../observability/metrics';
import { OBJECT_STORE } from '../media/s3-presign.service';
import type { ObjectStore } from '../media/s3-presign.service';
import { BulkImportJobRepository } from './bulk-import-job.repository';
import { BulkResultStore, MAX_RECORDED_ERRORS } from './bulk-result.store';
import { BULK_APPLIER_REGISTRY, BulkApplierRegistry } from './bulk-applier.registry';
import { parseCsv, recordToRow } from './csv-parser';
import { DomainEvent } from './domain/bulk-import.events';
import { CsvParseError, MissingColumnsError } from './domain/bulk-import.errors';

const PROGRESS_EVERY = 100;

export interface ProcessResult { jobId: string; status: string; succeeded: number; failed: number; skipped?: boolean; }

@Injectable()
export class BulkImportProcessor {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(METRICS) private readonly metrics: Metrics,
    @Inject(OBJECT_STORE) private readonly objects: ObjectStore,
    @Inject(BULK_APPLIER_REGISTRY) private readonly registry: BulkApplierRegistry,
    private readonly repo: BulkImportJobRepository,
    private readonly results: BulkResultStore,
  ) {}

  async process(tenantId: string, jobId: string): Promise<ProcessResult> {
    return timed(this.metrics, 'bulk.import.process', { tenant: tenantId }, async () => {
      // 1) CLAIM: pending → processing under a row lock (idempotent; a second worker sees processing and skips).
      const claimed = await this.uow.run(tenantId, async (tx) => {
        const job = await this.repo.getForUpdate(tx, tenantId, jobId);
        if (!job) return null;
        if (job.status !== 'pending') return job;   // already claimed/terminal — don't re-run
        job.begin(0);
        await this.repo.update(tx, job);
        return job;
      });
      if (!claimed) return { jobId, status: 'not_found', succeeded: 0, failed: 0, skipped: true };
      if (claimed.status !== 'processing') return { jobId, status: claimed.status, succeeded: 0, failed: 0, skipped: true };

      const importType = claimed.importType;
      const applier = this.registry.get(importType);
      const mapping = claimed.toProps().columnMapping;
      const actorUserId = claimed.requestedBy ?? '';

      // 2) Fetch + parse (fatal failures fail the whole job).
      let header: string[]; let records: string[][];
      try {
        if (!applier) throw new CsvParseError(`no applier for "${importType}"`);
        const bytes = await this.objects.getObject(claimed.storageKey);
        ({ header, records } = parseCsv(bytes.toString('utf8')));
        const effective = new Set(header.map((h) => mapping[h] ?? h));
        const missing = applier.requiredColumns.filter((c) => !effective.has(c));
        if (missing.length) throw new MissingColumnsError(missing);
      } catch (err: any) {
        await this.finishFatal(tenantId, jobId, err?.message ?? 'import failed');
        return { jobId, status: 'failed', succeeded: 0, failed: 0 };
      }

      // 3) Apply each row.
      let succeeded = 0; let failed = 0; let recorded = 0;
      for (let i = 0; i < records.length; i++) {
        const rowIndex = i + 1;                                  // 1-based, header excluded
        const { row, lengthMismatch } = recordToRow(header, records[i]);
        const mapped = this.applyMapping(row, mapping);
        if (lengthMismatch) {
          failed++; recorded = await this.maybeRecord(tenantId, jobId, rowIndex, 'ROW_SHAPE', 'column count does not match header', mapped, recorded);
          continue;
        }
        try {
          await applier!.applyRow({ tenantId, actorUserId }, `bulkrow:${jobId}:${rowIndex}`, mapped);
          succeeded++;
        } catch (err: any) {
          failed++;
          recorded = await this.maybeRecord(tenantId, jobId, rowIndex, err?.code ?? 'ROW_ERROR', err?.message ?? 'row failed', mapped, recorded);
        }
        if ((i + 1) % PROGRESS_EVERY === 0) await this.updateProgress(tenantId, jobId, i + 1, succeeded, failed);
      }

      // 4) Finish.
      const finalStatus = await this.finishJob(tenantId, jobId, records.length, succeeded, failed);
      this.metrics.inc('bulk.import.finished', { tenant: tenantId, status: finalStatus });
      return { jobId, status: finalStatus, succeeded, failed };
    });
  }

  private applyMapping(row: Record<string, string>, mapping: Record<string, string>): Record<string, string> {
    if (!mapping || Object.keys(mapping).length === 0) return row;
    const out: Record<string, string> = { ...row };
    for (const [csvCol, field] of Object.entries(mapping)) if (csvCol in row) out[field] = row[csvCol];
    return out;
  }
  private async maybeRecord(tenantId: string, jobId: string, rowIndex: number, code: string, message: string, raw: Record<string, unknown>, recorded: number): Promise<number> {
    if (recorded >= MAX_RECORDED_ERRORS) return recorded;
    await this.uow.run(tenantId, (tx) => this.results.recordError(tx, { tenantId, jobId, rowIndex, errorCode: code, errorMessage: message, raw }));
    return recorded + 1;
  }
  private async updateProgress(tenantId: string, jobId: string, processed: number, succeeded: number, failed: number): Promise<void> {
    await this.uow.run(tenantId, async (tx) => {
      const job = await this.repo.getForUpdate(tx, tenantId, jobId);
      if (!job || job.status !== 'processing') return;
      job.recordProgress(processed, succeeded, failed);
      await this.repo.update(tx, job);
    });
  }
  private async finishJob(tenantId: string, jobId: string, total: number, succeeded: number, failed: number): Promise<string> {
    return this.uow.run(tenantId, async (tx) => {
      const job = await this.repo.getForUpdate(tx, tenantId, jobId);
      if (!job || job.status !== 'processing') return job?.status ?? 'unknown';   // cancelled mid-run → leave it
      job.setTotalRows(total); job.recordProgress(total, succeeded, failed); job.finish();
      await this.repo.update(tx, job);
      await this.flush(tx, tenantId, jobId, job.pullEvents());
      return job.status;
    });
  }
  private async finishFatal(tenantId: string, jobId: string, summary: string): Promise<void> {
    await this.uow.run(tenantId, async (tx) => {
      const job = await this.repo.getForUpdate(tx, tenantId, jobId);
      if (!job || job.status !== 'processing') return;
      job.fail(summary);
      await this.repo.update(tx, job);
      await this.flush(tx, tenantId, jobId, job.pullEvents());
    });
  }
  private async flush(tx: TxContext, tenantId: string, jobId: string, evts: DomainEvent[]): Promise<void> {
    for (const e of evts) await this.outbox.write(tx, { tenantId, aggregateType: 'bulk_import_job', aggregateId: jobId, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
