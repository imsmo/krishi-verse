// modules/payments/services/payout-batch.service.ts
// Orchestrates a batched payout RUN (daily settlement run / weekly ambassador run / wage lane). A batch
// is a bookkeeping envelope: it groups queued payouts and records the settled total + count so a run is
// auditable. The MONEY moves per-payout, each in its own ACID tx via PayoutService.execute (wallet
// boundary, Law 2) — the batch never moves money itself, so a single payout failing can never poison
// the run. Lifecycle: open → (claim payouts) → executing → disburse each → executed.
//
// Driven by the WORKER (apps/worker) which owns a privileged Pool (kv_relay/kv_wallet) — payout_batches
// is an operational table outside tenant RLS. Bounded per run (Law 5); claiming uses FOR UPDATE SKIP
// LOCKED so concurrent runs never grab the same payout (no double-disburse). Read methods (getById/list)
// serve from the replica (CQRS).
import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { METRICS, Metrics } from '../../../core/observability/metrics';
import { TxContext } from '../../../core/database/unit-of-work';
import { uuidv7 } from '../../../core/database/uuid.util';
import { PayoutBatch } from '../domain/payout-batch.entity';
import { PayoutBatchStatus } from '../domain/payout-batch.state';
import { PayoutBatchRepository } from '../repositories/payout-batch.repository';
import { PayoutService } from './payout.service';
import { PaymentsPublisher } from '../events/payments.publisher';
import { decodePayoutBatchCursor } from '../dto/query-payout-batch.dto';

export interface RunBatchParams { batchType: string; tenantId?: string | null; maxPriority?: number | null; limit?: number; }
export interface RunBatchResult { batchId: string; claimed: number; succeeded: number; failed: number; totalMinor: string; status: PayoutBatchStatus; }

@Injectable()
export class PayoutBatchService {
  constructor(
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly repo: PayoutBatchRepository,
    private readonly payouts: PayoutService,
    private readonly publisher: PaymentsPublisher,
  ) {}

  /** Run one batch over the worker's privileged `pool`. Returns a bounded, auditable summary. */
  async runBatch(pool: Pool, params: RunBatchParams): Promise<RunBatchResult> {
    const limit = Math.min(Math.max(params.limit ?? 200, 1), 1000);
    const maxPriority = params.maxPriority ?? null;
    const batch = PayoutBatch.open({ id: uuidv7(), tenantId: params.tenantId ?? null, batchType: params.batchType });

    // 1) open the batch (committed so claimed payouts can reference a real batch_id row)
    await this.withTx(pool, async (tx) => this.repo.insert(tx, batch));

    // 2) claim queued payouts into the batch (own tx; commit so 'batch_id' marks are durable)
    const claimed = await this.withTx(pool, async (tx) => this.repo.claimQueuedIntoBatch(tx, batch.id, { limit, maxPriority }));

    // 3) mark executing (durable; a crash mid-run leaves the batch in 'executing' for recon to flag)
    batch.markExecuting();
    await this.withTx(pool, async (tx) => this.repo.update(tx, batch));

    // 4) disburse each — its own tenant-scoped tx via PayoutService.execute (gateway + ledger move)
    let succeeded = 0, failed = 0;
    for (const c of claimed) {
      try {
        const r = await this.payouts.execute(c.tenantId, c.id);
        if (r.status === 'success') { batch.addSettled(c.amountMinor); succeeded++; }
        else if (r.status === 'failed' || r.status === 'reversed') { failed++; }
        // 'processing' (async) / 'skipped' → neither settled nor failed; confirmed later via webhook
      } catch { failed++; /* ambiguous transport error: payout stays claimed, retried; never double-paid */ }
    }

    // 5) finalize: persist totals + 'executed' + emit one batch event (in the same tx, Law 4)
    batch.markExecuted();
    await this.withTx(pool, async (tx) => {
      await this.repo.update(tx, batch);
      await this.publisher.batchExecuted(tx, batch.toProps().tenantId, batch.id, params.batchType, batch.totalMinor, batch.count);
    });
    this.metrics.inc('payments.payout_batch_executed', { type: params.batchType });
    return { batchId: batch.id, claimed: claimed.length, succeeded, failed, totalMinor: batch.totalMinor.toString(), status: batch.status };
  }

  // --- reads (replica, CQRS) ---
  async getById(id: string) { const b = await this.repo.getById(id); return b ? this.serialize(b) : null; }
  async list(q: { status?: PayoutBatchStatus; batchType?: string; cursor?: string; limit: number }) {
    const items = (await this.repo.list({ status: q.status, batchType: q.batchType, cursor: decodePayoutBatchCursor(q.cursor), limit: q.limit })).map((b) => this.serialize(b));
    const last = items[items.length - 1];
    return { items, nextCursor: items.length === q.limit && last ? Buffer.from(`${last.createdAt}|${last.id}`).toString('base64') : null };
  }

  private serialize(b: PayoutBatch) {
    const v = b.toProps();
    return { id: v.id, tenantId: v.tenantId, batchType: v.batchType, totalMinor: v.totalMinor.toString(), count: v.count, status: v.status, executedAt: v.executedAt, createdAt: v.createdAt };
  }

  private async withTx<T>(pool: Pool, fn: (tx: TxContext) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const tx: TxContext = { query: (sql, params) => client.query(sql, params as any) as any, tenantId: '', userId: 'system' };
      const r = await fn(tx);
      await client.query('COMMIT');
      return r;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally {
      client.release();
    }
  }
}
