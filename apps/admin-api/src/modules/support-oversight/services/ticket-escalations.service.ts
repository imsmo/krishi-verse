// apps/admin-api/src/modules/support-oversight/services/ticket-escalations.service.ts · the ONE consequential
// write: a platform operator ESCALATES a tenant's ticket (raise severity / move to 'escalated' / reassign to a
// platform lead) when the tenant's support is failing its SLA. One ACID tx: lock the ticket FOR UPDATE → domain
// escalate (raise-only severity, state machine, recomputed SLA clock, must-change) → UPDATE support_tickets →
// audit_log row, atomic (§4). Escalation goes through the ticket state machine (Law 5); a resolved/closed ticket
// can't be escalated; a reassign target must be a real user (404). Cross-tenant by design (kv_admin); audited.
import { Injectable } from '@nestjs/common';
import { AdminPool } from '../../../core/database/admin-pool';
import { AdminAuditWriter } from '../../../core/audit/admin-audit.writer';
import { AdminRequestContext } from '../../../core/auth/admin-auth.guard';
import { SupportOversightRepository } from '../repositories/support-oversight.repository';
import { TicketNotFoundError, AssigneeNotFoundError } from '../domain/support-oversight.errors';
import { EscalateTicketDto } from '../dto/support-oversight.dto';

@Injectable()
export class TicketEscalationsService {
  constructor(private readonly pool: AdminPool, private readonly audit: AdminAuditWriter, private readonly repo: SupportOversightRepository) {}

  async escalate(actor: AdminRequestContext, id: string, dto: EscalateTicketDto) {
    // Validate the reassign target up-front (outside the row lock) — 404 if it isn't a real user.
    if (dto.reassignToUserId && !(await this.repo.userExists(dto.reassignToUserId))) throw new AssigneeNotFoundError(dto.reassignToUserId);

    return this.pool.withTx(async (client) => {
      const ticket = await this.repo.getTicketForUpdate(client, id);
      if (!ticket) throw new TicketNotFoundError(id);
      const beforeJson = ticket.toJSON();
      const change = ticket.escalate(dto.severity ?? null, dto.reassignToUserId ?? null);   // throws on illegal/no-op/downgrade
      const after = ticket.toJSON();
      await this.repo.updateEscalation(client, id, {
        severity: after.severity as any, status: after.status as any, assigneeUserId: after.assigneeUserId,
        slaFirstResponseDue: change.slaFirstResponseDue, slaResolutionDue: change.slaResolutionDue,
      }, actor.userId);
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null,
        action: 'support.ticket_escalated', entityType: 'support_ticket', entityId: id,
        oldValue: { tenantId: beforeJson.tenantId, severity: beforeJson.severity, status: beforeJson.status, assigneeUserId: beforeJson.assigneeUserId },
        newValue: { severity: after.severity, status: after.status, assigneeUserId: after.assigneeUserId, severityChange: change.severityChange, statusChange: change.statusChange },
        reason: dto.reason, ip: actor.ip, requestId: actor.requestId || null });
      return after;
    });
  }
}
