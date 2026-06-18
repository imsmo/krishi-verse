// modules/disputes/events/handlers/dispute-refunded.handler.ts
// Consumes payments.dispute_refunded (via the outbox relay). Stamps the ledger reversal txn id onto the
// resolved dispute (resolution_txn_id) — the audit link from the decision to the actual money movement.
// Runs INSIDE the relay tx, touches only the disputes module's own table. IDEMPOTENT: stamps only once.
import { Injectable } from '@nestjs/common';
import { OutboxEvent, OutboxHandler } from '../../../../core/outbox/event-envelope';
import { TxContext } from '../../../../core/database/unit-of-work';
import { DisputeRepository } from '../../repositories/dispute.repository';

@Injectable()
export class DisputeRefundedHandler implements OutboxHandler {
  readonly eventType = 'payments.dispute_refunded';
  constructor(private readonly repo: DisputeRepository) {}

  async handle(event: OutboxEvent, tx: TxContext): Promise<void> {
    const tenantId = event.tenantId;
    const p = event.payload as Record<string, unknown>;
    const disputeId = (p.disputeId as string | undefined) ?? event.aggregateId;
    const txnId = p.txnId as string | undefined;
    if (!tenantId || !disputeId || !txnId) return;
    await this.repo.stampResolutionTxn(tx, tenantId, disputeId, txnId);
  }
}
