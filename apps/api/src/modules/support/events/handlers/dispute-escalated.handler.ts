// modules/support/events/handlers/dispute-escalated.handler.ts · consumes disputes.dispute_escalated.
// Auto-opens a P1 support ticket so an agent picks up the escalated dispute. Runs inside the relay's per-event
// tx; IDEMPOTENT — the ticket_no is derived deterministically from the dispute id, and autoOpen no-ops if it
// already exists. Money-free.
import { OutboxEvent, OutboxHandler } from '../../../../core/outbox/event-envelope';
import { TxContext } from '../../../../core/database/unit-of-work';
import { SupportTicketService } from '../../services/support-ticket.service';

export class DisputeEscalatedHandler implements OutboxHandler {
  readonly eventType = 'disputes.dispute_escalated';
  constructor(private readonly tickets: SupportTicketService) {}
  async handle(event: OutboxEvent, tx: TxContext): Promise<void> {
    if (!event.tenantId) return;
    const disputeId = event.aggregateId;
    await this.tickets.autoOpen(tx, {
      tenantId: event.tenantId,
      ticketNo: `DSP-${disputeId.replace(/-/g, '').slice(0, 12).toUpperCase()}`,
      requesterUserId: typeof event.payload.raisedBy === 'string' ? (event.payload.raisedBy as string) : null,
      channel: 'app', severity: 'P1', subject: `Escalated dispute ${disputeId}`, categoryId: null,
    });
  }
}
