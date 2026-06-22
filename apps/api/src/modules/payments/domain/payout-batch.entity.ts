// modules/payments/domain/payout-batch.entity.ts
// PayoutBatch aggregate (pure domain: bigint minor units, status only via the state machine). A batch
// groups N queued payouts for a coordinated disbursement run. The wallet moves are per-payout and
// atomic (PayoutService.execute); this aggregate accumulates the settled total + count so the run is
// auditable. tenantId is nullable — a run can be platform-wide (e.g. the weekly ambassador run).
import { PayoutBatchStatus, assertTransition } from './payout-batch.state';

export interface PayoutBatchProps {
  id: string;
  tenantId: string | null;
  batchType: string;
  totalMinor: bigint;
  count: number;
  status: PayoutBatchStatus;
  executedAt: Date | null;
  createdAt: Date;
}

export class PayoutBatch {
  private constructor(private props: PayoutBatchProps) {}

  static open(input: { id: string; tenantId: string | null; batchType: string; now?: Date }): PayoutBatch {
    const t = (input.batchType ?? '').trim();
    if (!t || t.length > 40) throw new Error('payout batch type must be 1..40 chars');
    return new PayoutBatch({
      id: input.id, tenantId: input.tenantId, batchType: t,
      totalMinor: 0n, count: 0, status: 'open', executedAt: null, createdAt: input.now ?? new Date(),
    });
  }
  static rehydrate(props: PayoutBatchProps): PayoutBatch { return new PayoutBatch(props); }

  get id() { return this.props.id; }
  get status() { return this.props.status; }
  get totalMinor() { return this.props.totalMinor; }
  get count() { return this.props.count; }
  toProps(): Readonly<PayoutBatchProps> { return Object.freeze({ ...this.props }); }

  /** Account a successfully-disbursed payout into the running total (only while open/executing). */
  addSettled(amountMinor: bigint): void {
    if (this.props.status !== 'open' && this.props.status !== 'executing') {
      throw new Error('cannot add to a finalized payout batch');
    }
    if (amountMinor <= 0n) throw new Error('settled amount must be positive');
    this.props.totalMinor += amountMinor;
    this.props.count += 1;
  }

  markExecuting(): void { this.to('executing'); }
  markExecuted(now?: Date): void { this.to('executed'); this.props.executedAt = now ?? new Date(); }
  markFailed(): void { this.to('failed'); }

  private to(status: PayoutBatchStatus): void { assertTransition(this.props.status, status); this.props.status = status; }
}
