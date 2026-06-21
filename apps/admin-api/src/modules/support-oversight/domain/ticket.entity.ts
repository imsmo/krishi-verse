// apps/admin-api/src/modules/support-oversight/domain/ticket.entity.ts · the oversight view of a support_tickets
// row (pure, no I/O). The god-mode plane only ESCALATES (the one consequential write): raise priority and/or move
// the ticket to 'escalated', optionally reassigning to a platform lead. Escalation can only RAISE severity, goes
// through the ticket state machine (Law 5), recomputes the SLA clock from the new severity, and must change
// something. Money-free (support is a helpdesk).
import { TicketStatus, assertTransition, isTerminalForEscalation } from './ticket.state';
import { Severity, assertSeverityRaise, computeSla, slaState, SlaState } from './sla';
import { InvalidEscalationError, IllegalTicketTransitionError } from './support-oversight.errors';

export interface TicketProps {
  id: string; tenantId: string | null; ticketNo: string; requesterUserId: string | null; channel: string; categoryId: string | null;
  severity: Severity; subject: string | null; status: TicketStatus; assigneeUserId: string | null;
  slaFirstResponseDue: Date | null; slaResolutionDue: Date | null; firstRespondedAt: Date | null; resolvedAt: Date | null;
  createdAt: Date;
}
export interface EscalateResult {
  severityChange: { from: Severity; to: Severity } | null;
  statusChange: { from: TicketStatus; to: TicketStatus } | null;
  assigneeChange: { from: string | null; to: string } | null;
  slaFirstResponseDue: Date | null; slaResolutionDue: Date | null;
}

export class SupportTicketOversight {
  private constructor(private p: TicketProps) {}
  static rehydrate(p: TicketProps): SupportTicketOversight { return new SupportTicketOversight(p); }

  get id(): string { return this.p.id; }
  get tenantId(): string | null { return this.p.tenantId; }
  get status(): TicketStatus { return this.p.status; }

  sla(now = new Date()): SlaState {
    return slaState({ status: this.p.status, slaFirstResponseDue: this.p.slaFirstResponseDue, slaResolutionDue: this.p.slaResolutionDue, firstRespondedAt: this.p.firstRespondedAt, resolvedAt: this.p.resolvedAt }, now);
  }

  /** Escalate: optional severity raise (recomputes SLA), move to 'escalated' (if not already), optional reassign. */
  escalate(newSeverity: Severity | null, reassignToUserId: string | null): EscalateResult {
    if (isTerminalForEscalation(this.p.status)) throw new IllegalTicketTransitionError(this.p.status, 'escalated');

    let severityChange: EscalateResult['severityChange'] = null;
    if (newSeverity && newSeverity !== this.p.severity) {
      assertSeverityRaise(this.p.severity, newSeverity);                 // throws if it would lower priority
      severityChange = { from: this.p.severity, to: newSeverity };
      this.p.severity = newSeverity;
      const sla = computeSla(newSeverity, this.p.createdAt);             // tighter clock for the higher severity
      this.p.slaFirstResponseDue = sla.firstResponseDue; this.p.slaResolutionDue = sla.resolutionDue;
    }

    let statusChange: EscalateResult['statusChange'] = null;
    if (this.p.status !== 'escalated') {
      assertTransition(this.p.status, 'escalated');                      // legal from open/pending_*/reopened
      statusChange = { from: this.p.status, to: 'escalated' };
      this.p.status = 'escalated';
    }

    let assigneeChange: EscalateResult['assigneeChange'] = null;
    if (reassignToUserId && reassignToUserId !== this.p.assigneeUserId) {
      assigneeChange = { from: this.p.assigneeUserId, to: reassignToUserId };
      this.p.assigneeUserId = reassignToUserId;
    }

    if (!severityChange && !statusChange && !assigneeChange) throw new InvalidEscalationError('nothing to escalate (already escalated at this severity/assignee)');
    return { severityChange, statusChange, assigneeChange, slaFirstResponseDue: this.p.slaFirstResponseDue, slaResolutionDue: this.p.slaResolutionDue };
  }

  toJSON() {
    const v = this.p;
    return { id: v.id, tenantId: v.tenantId, ticketNo: v.ticketNo, requesterUserId: v.requesterUserId, channel: v.channel, categoryId: v.categoryId,
      severity: v.severity, subject: v.subject, status: v.status, assigneeUserId: v.assigneeUserId,
      slaFirstResponseDue: v.slaFirstResponseDue, slaResolutionDue: v.slaResolutionDue, firstRespondedAt: v.firstRespondedAt, resolvedAt: v.resolvedAt,
      createdAt: v.createdAt, sla: this.sla() };
  }
}
