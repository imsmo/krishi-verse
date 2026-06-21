// apps/admin-api/src/modules/support-oversight/repositories/support-oversight.repository.ts · ALL SQL for support-
// oversight. The platform NOC view is CROSS-TENANT: support_tickets is a tenant-scoped table with RLS, and
// admin-api connects as kv_admin (RLS-bypass) so the oversight plane sees every tenant — every read is bounded +
// keyset, every write audited. READS: ticket queue (filters incl. SLA-breach), the breach queue, a single ticket,
// and per-tenant health rollups. WRITE (in the caller's tx): the escalation UPDATE. Parameterised; keyset (never
// OFFSET). Support is money-free.
import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { AdminPool } from '../../../core/database/admin-pool';
import { SupportTicketOversight, TicketProps } from '../domain/ticket.entity';
import { Severity } from '../domain/sla';
import { TicketStatus } from '../domain/ticket.state';

const COLS = `id, tenant_id, ticket_no, requester_user_id, channel, category_id, severity, subject, status, assignee_user_id,
              sla_first_response_due, sla_resolution_due, first_responded_at, resolved_at, created_at`;
// A still-working ticket past an unsatisfied SLA due date.
const BREACH_SQL = `status IN ('open','pending_customer','pending_internal','escalated','reopened') AND (
  (first_responded_at IS NULL AND sla_first_response_due IS NOT NULL AND sla_first_response_due < now())
  OR (resolved_at IS NULL AND sla_resolution_due IS NOT NULL AND sla_resolution_due < now()))`;
const WORKING_SQL = `status IN ('open','pending_customer','pending_internal','escalated','reopened')`;

function toTicket(r: any): SupportTicketOversight {
  const props: TicketProps = {
    id: r.id, tenantId: r.tenant_id ?? null, ticketNo: r.ticket_no, requesterUserId: r.requester_user_id ?? null, channel: r.channel,
    categoryId: r.category_id ?? null, severity: r.severity as Severity, subject: r.subject ?? null, status: r.status as TicketStatus,
    assigneeUserId: r.assignee_user_id ?? null, slaFirstResponseDue: r.sla_first_response_due ?? null, slaResolutionDue: r.sla_resolution_due ?? null,
    firstRespondedAt: r.first_responded_at ?? null, resolvedAt: r.resolved_at ?? null, createdAt: r.created_at,
  };
  return SupportTicketOversight.rehydrate(props);
}

export interface TicketListQuery { tenantId?: string; status?: TicketStatus; severity?: Severity; slaBreached?: boolean; assigned?: boolean; cursor?: { c: string; id: string }; limit: number; }
export interface BreachListQuery { tenantId?: string; severity?: Severity; cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class SupportOversightRepository {
  constructor(private readonly pool: AdminPool) {}

  async listTickets(q: TicketListQuery): Promise<SupportTicketOversight[]> {
    const params: unknown[] = []; const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    let where = 'deleted_at IS NULL';
    if (q.tenantId) where += ` AND tenant_id=${p(q.tenantId)}`;
    if (q.status) where += ` AND status=${p(q.status)}`;
    if (q.severity) where += ` AND severity=${p(q.severity)}`;
    if (q.assigned !== undefined) where += q.assigned ? ` AND assignee_user_id IS NOT NULL` : ` AND assignee_user_id IS NULL`;
    if (q.slaBreached !== undefined) where += q.slaBreached ? ` AND (${BREACH_SQL})` : ` AND NOT (${BREACH_SQL})`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.pool.query(`SELECT ${COLS} FROM support_tickets WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toTicket);
  }

  async listBreaches(q: BreachListQuery): Promise<SupportTicketOversight[]> {
    const params: unknown[] = []; const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    let where = `deleted_at IS NULL AND (${BREACH_SQL})`;
    if (q.tenantId) where += ` AND tenant_id=${p(q.tenantId)}`;
    if (q.severity) where += ` AND severity=${p(q.severity)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    // Most-urgent-first for the breach queue: highest severity (P0 first), then oldest.
    const r = await this.pool.query(`SELECT ${COLS} FROM support_tickets WHERE ${where} ORDER BY severity ASC, created_at ASC, id ASC LIMIT ${lp}`, params);
    return r.rows.map(toTicket);
  }

  async getTicket(id: string): Promise<SupportTicketOversight | null> {
    const r = await this.pool.query(`SELECT ${COLS} FROM support_tickets WHERE id=$1 AND deleted_at IS NULL`, [id]);
    return r.rows[0] ? toTicket(r.rows[0]) : null;
  }
  async getTicketForUpdate(client: PoolClient, id: string): Promise<SupportTicketOversight | null> {
    const r = await client.query(`SELECT ${COLS} FROM support_tickets WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`, [id]);
    return r.rows[0] ? toTicket(r.rows[0]) : null;
  }

  async updateEscalation(client: PoolClient, id: string, u: { severity: Severity; status: TicketStatus; assigneeUserId: string | null; slaFirstResponseDue: Date | null; slaResolutionDue: Date | null }, actorUserId: string): Promise<void> {
    await client.query(
      `UPDATE support_tickets SET severity=$2, status=$3, assignee_user_id=$4, sla_first_response_due=$5, sla_resolution_due=$6, updated_by=$7, updated_at=now() WHERE id=$1`,
      [id, u.severity, u.status, u.assigneeUserId, u.slaFirstResponseDue, u.slaResolutionDue, actorUserId]);
  }

  async userExists(userId: string): Promise<boolean> {
    const r = await this.pool.query(`SELECT 1 FROM users WHERE id=$1`, [userId]);
    return (r.rowCount ?? 0) > 0;
  }

  /** Per-tenant support health. tenantId set ⇒ that tenant (one row or empty); else the top tenants by open breaches. */
  async tenantHealth(tenantId: string | undefined, limit: number): Promise<{ tenantId: string; openCount: number; breachedCount: number; p0Open: number; oldestOpenAgeSec: number | null }[]> {
    const params: unknown[] = [];
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    let where = `deleted_at IS NULL AND tenant_id IS NOT NULL`;
    if (tenantId) where += ` AND tenant_id=${p(tenantId)}`;
    const tail = tenantId ? '' : ` HAVING count(*) FILTER (WHERE ${BREACH_SQL}) > 0 ORDER BY count(*) FILTER (WHERE ${BREACH_SQL}) DESC, count(*) FILTER (WHERE ${WORKING_SQL}) DESC LIMIT ${p(limit)}`;
    const r = await this.pool.query(
      `SELECT tenant_id,
              count(*) FILTER (WHERE ${WORKING_SQL})::int AS open_count,
              count(*) FILTER (WHERE ${BREACH_SQL})::int AS breached_count,
              count(*) FILTER (WHERE severity='P0' AND ${WORKING_SQL})::int AS p0_open,
              EXTRACT(EPOCH FROM (now() - min(created_at) FILTER (WHERE ${WORKING_SQL})))::bigint AS oldest_open_age_sec
         FROM support_tickets WHERE ${where} GROUP BY tenant_id${tail}`, params);
    return r.rows.map((x: any) => ({ tenantId: x.tenant_id, openCount: x.open_count ?? 0, breachedCount: x.breached_count ?? 0, p0Open: x.p0_open ?? 0, oldestOpenAgeSec: x.oldest_open_age_sec != null ? Number(x.oldest_open_age_sec) : null }));
  }
}
