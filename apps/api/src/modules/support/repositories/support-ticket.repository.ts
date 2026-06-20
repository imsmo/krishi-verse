// modules/support/repositories/support-ticket.repository.ts · support_tickets. tenant_id in every query (Law 1)
// + RLS. No version → mutations lock FOR UPDATE. ticket_no is globally UNIQUE (existsByTicketNo backs idempotent
// auto-open). Keyset lists; the `queue` box is open tickets ordered by severity then age (oldest-first triage).
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { SupportTicket } from '../domain/support-ticket.entity';
import { TicketChannel, TicketSeverity } from '../domain/support.events';
import { TicketStatus } from '../domain/support-ticket.state';

const COLS = `id, tenant_id, ticket_no, requester_user_id, channel, category_id, severity, subject, status, assignee_user_id, conversation_id, sla_first_response_due, sla_resolution_due, first_responded_at, resolved_at, csat_score, created_at`;
function toDomain(r: any): SupportTicket {
  return SupportTicket.rehydrate({ id: r.id, tenantId: r.tenant_id, ticketNo: r.ticket_no, requesterUserId: r.requester_user_id, channel: r.channel as TicketChannel,
    categoryId: r.category_id, severity: r.severity as TicketSeverity, subject: r.subject, status: r.status as TicketStatus, assigneeUserId: r.assignee_user_id,
    conversationId: r.conversation_id, slaFirstResponseDue: r.sla_first_response_due, slaResolutionDue: r.sla_resolution_due, firstRespondedAt: r.first_responded_at,
    resolvedAt: r.resolved_at, csatScore: r.csat_score, createdAt: r.created_at });
}
export interface TicketListQuery { box: 'mine' | 'assigned' | 'queue'; requesterUserId?: string; assigneeUserId?: string; status?: string; severity?: string; cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class SupportTicketRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async insert(tx: TxContext, t: SupportTicket): Promise<void> {
    const p = t.toProps();
    await tx.query(
      `INSERT INTO support_tickets (id, tenant_id, ticket_no, requester_user_id, channel, category_id, severity, subject, status, assignee_user_id, conversation_id, sla_first_response_due, sla_resolution_due, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$4)`,
      [p.id, p.tenantId, p.ticketNo, p.requesterUserId, p.channel, p.categoryId, p.severity, p.subject, p.status, p.assigneeUserId, p.conversationId, p.slaFirstResponseDue, p.slaResolutionDue]);
  }
  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<SupportTicket | null> {
    const r = await tx.query(`SELECT ${COLS} FROM support_tickets WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async getById(tenantId: string, id: string): Promise<SupportTicket | null> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM support_tickets WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async existsByTicketNo(tx: TxContext, ticketNo: string): Promise<boolean> {
    const r = await tx.query(`SELECT 1 FROM support_tickets WHERE ticket_no=$1 LIMIT 1`, [ticketNo]);
    return (r.rowCount ?? 0) > 0;
  }
  async update(tx: TxContext, t: SupportTicket): Promise<void> {
    const p = t.toProps();
    await tx.query(`UPDATE support_tickets SET severity=$3, status=$4, assignee_user_id=$5, first_responded_at=$6, resolved_at=$7, csat_score=$8, updated_at=now()
       WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`,
      [p.id, p.tenantId, p.severity, p.status, p.assigneeUserId, p.firstRespondedAt, p.resolvedAt, p.csatScore]);
  }
  async listFor(tenantId: string, q: TicketListQuery): Promise<SupportTicket[]> {
    const params: unknown[] = [tenantId]; let where = `tenant_id=$1 AND deleted_at IS NULL`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.box === 'mine' && q.requesterUserId) where += ` AND requester_user_id=${p(q.requesterUserId)}`;
    if (q.box === 'assigned' && q.assigneeUserId) where += ` AND assignee_user_id=${p(q.assigneeUserId)}`;
    if (q.box === 'queue') where += ` AND status NOT IN ('resolved','closed')`;
    if (q.status) where += ` AND status=${p(q.status)}`;
    if (q.severity) where += ` AND severity=${p(q.severity)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM support_tickets WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }
}
