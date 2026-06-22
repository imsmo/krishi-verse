// modules/payments/events/payments.publisher.ts
// Typed façade over the outbox writer for the payments module's integration events. Every event is
// written INSIDE the caller's db transaction (Law 4) so the state change and the event commit
// atomically — no event is ever emitted for a write that rolled back, and none is lost for a write
// that committed. Payloads are versioned ({ v: 1, ... }) and carry NO PII/bank details (only ids +
// minor-unit amounts as strings). Consumers are at-least-once + idempotent.
import { Inject, Injectable } from '@nestjs/common';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { TxContext } from '../../../core/database/unit-of-work';

export const PayoutEventType = {
  Queued:    'payments.payout_queued',
  Succeeded: 'payments.payout_succeeded',
  Failed:    'payments.payout_failed',
  Batched:   'payments.payout_batch_executed',
} as const;
export type PayoutEventType = (typeof PayoutEventType)[keyof typeof PayoutEventType];

@Injectable()
export class PaymentsPublisher {
  constructor(@Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter) {}

  async payoutSucceeded(tx: TxContext, tenantId: string, payoutId: string, amountMinor: bigint): Promise<void> {
    await this.outbox.write(tx, { tenantId, aggregateType: 'payout', aggregateId: payoutId, eventType: PayoutEventType.Succeeded, payload: { v: 1, payoutId, amountMinor: amountMinor.toString() } });
  }
  async payoutFailed(tx: TxContext, tenantId: string, payoutId: string, failureCode: string): Promise<void> {
    await this.outbox.write(tx, { tenantId, aggregateType: 'payout', aggregateId: payoutId, eventType: PayoutEventType.Failed, payload: { v: 1, payoutId, failureCode } });
  }
  async batchExecuted(tx: TxContext, tenantId: string | null, batchId: string, batchType: string, totalMinor: bigint, count: number): Promise<void> {
    await this.outbox.write(tx, { tenantId, aggregateType: 'payout_batch', aggregateId: batchId, eventType: PayoutEventType.Batched, payload: { v: 1, batchId, batchType, totalMinor: totalMinor.toString(), count } });
  }
}
