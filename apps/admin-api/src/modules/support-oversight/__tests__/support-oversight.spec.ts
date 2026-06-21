// apps/admin-api/src/modules/support-oversight/__tests__/support-oversight.spec.ts · unit tests (pure/mocked).
// Covers: the SLA math (breach detection, severity-raise guard, recompute) mirroring apps/api; the ticket state
// machine; the escalate entity (raise-only, state machine, recompute SLA, must-change, no escalating a closed
// ticket); owner-RBAC for the support-oversight roles + no-escalation (Law 11); DTO validation; and the services
// proving audit-in-tx on escalate, 404s (ticket / assignee), and that reads return computed SLA state.
import { SupportTicketOversight } from '../domain/ticket.entity';
import { canTransition, assertTransition, isWorking } from '../domain/ticket.state';
import { slaState, computeSla, assertSeverityRaise, severityRank, SLA_MINUTES } from '../domain/sla';
import { TicketNotFoundError, AssigneeNotFoundError, InvalidEscalationError, IllegalTicketTransitionError } from '../domain/support-oversight.errors';
import { SlaBreachMonitorService } from '../services/sla-breach-monitor.service';
import { TicketEscalationsService } from '../services/ticket-escalations.service';
import { QueryTicketsSchema, EscalateTicketSchema, TenantHealthSchema } from '../dto/support-oversight.dto';
import { resolveOwnerPermissions, hasOwnerPermission, OwnerPermissions } from '../../../core/rbac/owner-roles';

const actor = { userId: 'admin1', roles: ['platform_support_oversight'], ip: '10.0.0.1', requestId: 'req1' } as any;
const TENANT = '11111111-1111-1111-1111-111111111111';
const USER = '22222222-2222-2222-2222-222222222222';
const ticket = (over: Partial<any> = {}) => SupportTicketOversight.rehydrate({
  id: 't1', tenantId: TENANT, ticketNo: 'TKT-1', requesterUserId: USER, channel: 'app', categoryId: null,
  severity: over.severity ?? 'P2', subject: 'cannot pay', status: over.status ?? 'open', assigneeUserId: over.assigneeUserId ?? null,
  slaFirstResponseDue: over.slaFirstResponseDue ?? new Date(Date.now() + 3600_000), slaResolutionDue: over.slaResolutionDue ?? new Date(Date.now() + 7200_000),
  firstRespondedAt: over.firstRespondedAt ?? null, resolvedAt: over.resolvedAt ?? null, createdAt: over.createdAt ?? new Date('2026-06-01T00:00:00Z'),
});

describe('SLA math', () => {
  it('breach when working + past an unsatisfied due; not breached once responded/resolved or terminal', () => {
    const base = { slaResolutionDue: new Date(Date.now() + 1e9), firstRespondedAt: null, resolvedAt: null };
    expect(slaState({ status: 'open', slaFirstResponseDue: new Date(Date.now() - 1000), ...base }, new Date()).firstResponseBreached).toBe(true);
    expect(slaState({ status: 'open', slaFirstResponseDue: new Date(Date.now() - 1000), firstRespondedAt: new Date(), slaResolutionDue: new Date(Date.now() + 1e9), resolvedAt: null }, new Date()).breached).toBe(false);
    expect(slaState({ status: 'closed', slaFirstResponseDue: new Date(Date.now() - 1000), ...base }, new Date()).breached).toBe(false);   // terminal ⇒ not breaching
  });
  it('severity raise guard + rank + recompute', () => {
    expect(severityRank('P0')).toBeLessThan(severityRank('P3'));
    expect(() => assertSeverityRaise('P2', 'P0')).not.toThrow();
    expect(() => assertSeverityRaise('P2', 'P3')).toThrow(InvalidEscalationError);   // lower priority
    expect(() => assertSeverityRaise('P1', 'P1')).toThrow(InvalidEscalationError);   // same
    const base = new Date('2026-06-01T00:00:00Z');
    const sla = computeSla('P0', base);
    expect(sla.firstResponseDue.getTime()).toBe(base.getTime() + SLA_MINUTES.P0.firstResponse * 60_000);
  });
});

describe('ticket state machine', () => {
  it('working → escalated legal; resolved/closed → escalated illegal', () => {
    expect(canTransition('open', 'escalated')).toBe(true);
    expect(canTransition('pending_internal', 'escalated')).toBe(true);
    expect(canTransition('resolved', 'escalated')).toBe(false);
    expect(isWorking('escalated')).toBe(true); expect(isWorking('closed')).toBe(false);
    expect(() => assertTransition('closed', 'escalated')).toThrow(IllegalTicketTransitionError);
  });
});

describe('escalate entity', () => {
  it('raises severity (recomputes SLA), moves to escalated, reassigns; reports the change', () => {
    const t = ticket({ severity: 'P2', status: 'open' });
    const r = t.escalate('P0', USER);
    expect(r.severityChange).toEqual({ from: 'P2', to: 'P0' });
    expect(r.statusChange).toEqual({ from: 'open', to: 'escalated' });
    expect(r.assigneeChange).toEqual({ from: null, to: USER });
    const j = t.toJSON();
    expect(j.severity).toBe('P0'); expect(j.status).toBe('escalated');
    expect(j.slaFirstResponseDue!.getTime()).toBe(new Date('2026-06-01T00:00:00Z').getTime() + SLA_MINUTES.P0.firstResponse * 60_000);
  });
  it('refuses a downgrade, a no-op, and escalating a closed ticket', () => {
    expect(() => ticket({ severity: 'P1', status: 'open' }).escalate('P2', null)).toThrow(InvalidEscalationError);          // downgrade
    expect(() => ticket({ severity: 'P0', status: 'escalated', assigneeUserId: USER }).escalate('P0', USER)).toThrow(InvalidEscalationError);  // no-op
    expect(() => ticket({ status: 'closed' }).escalate('P0', null)).toThrow(IllegalTicketTransitionError);
  });
  it('escalate with only status change (already top severity, not yet escalated) works', () => {
    const t = ticket({ severity: 'P0', status: 'open' });
    const r = t.escalate(null, null);
    expect(r.severityChange).toBeNull();
    expect(r.statusChange).toEqual({ from: 'open', to: 'escalated' });
  });
});

describe('owner roles for support-oversight', () => {
  it('oversight manage+read; viewer read-only; tenant roles NOTHING; no cross-perm / no *', () => {
    const ops = resolveOwnerPermissions(['platform_support_oversight']);
    expect(hasOwnerPermission(ops, OwnerPermissions.SupportOversightManage)).toBe(true);
    expect(hasOwnerPermission(ops, OwnerPermissions.SupportOversightRead)).toBe(true);
    expect(hasOwnerPermission(resolveOwnerPermissions(['platform_support_oversight_viewer']), OwnerPermissions.SupportOversightManage)).toBe(false);
    expect(hasOwnerPermission(resolveOwnerPermissions(['platform_support_oversight_viewer']), OwnerPermissions.SupportOversightRead)).toBe(true);
    expect(hasOwnerPermission(resolveOwnerPermissions(['tenant_admin']), OwnerPermissions.SupportOversightManage)).toBe(false);
    expect(ops.has('*')).toBe(false);
    expect(hasOwnerPermission(ops, OwnerPermissions.BillingManage)).toBe(false);
  });
});

describe('dto validation', () => {
  it('queries: enums + bools + clamp; escalate requires reason; rejects unknown keys', () => {
    expect(QueryTicketsSchema.safeParse({ severity: 'P0', slaBreached: 'true', limit: 50 }).success).toBe(true);
    expect(QueryTicketsSchema.safeParse({ severity: 'P9' }).success).toBe(false);
    expect(QueryTicketsSchema.safeParse({ limit: 999 }).success).toBe(false);
    expect(QueryTicketsSchema.safeParse({ evil: 1 }).success).toBe(false);
    expect(EscalateTicketSchema.safeParse({ severity: 'P0', reason: 'tenant SLA failing' }).success).toBe(true);
    expect(EscalateTicketSchema.safeParse({ reason: 'esc' }).success).toBe(true);   // status-only escalation
    expect(EscalateTicketSchema.safeParse({ severity: 'P0' }).success).toBe(false); // reason required
    expect(TenantHealthSchema.safeParse({ limit: 20 }).success).toBe(true);
  });
});

function harness() {
  const client = { __c: true };
  const pool = { withTx: async (fn: any) => fn(client) } as any;
  const audit = { write: jest.fn(async () => undefined) } as any;
  return { client, pool, audit };
}

describe('SlaBreachMonitorService', () => {
  it('getTicket 404 when missing; returns computed SLA on detail', async () => {
    const repo1 = { getTicket: jest.fn(async () => null) } as any;
    await expect(new SlaBreachMonitorService(repo1).getTicket('t1')).rejects.toBeInstanceOf(TicketNotFoundError);
    const repo2 = { getTicket: jest.fn(async () => ticket({ status: 'open', slaFirstResponseDue: new Date(Date.now() - 1000) })) } as any;
    const out: any = await new SlaBreachMonitorService(repo2).getTicket('t1');
    expect(out.sla.firstResponseBreached).toBe(true);
  });
  it('listBreaches maps + paginates', async () => {
    const repo = { listBreaches: jest.fn(async () => [ticket(), ticket()]) } as any;
    const out = await new SlaBreachMonitorService(repo).listBreaches({ limit: 2 });
    expect(out.items.length).toBe(2);
    expect(out.nextCursor).toBeTruthy();   // full page ⇒ cursor
  });
});

describe('TicketEscalationsService', () => {
  it('404 when ticket missing', async () => {
    const { pool, audit } = harness();
    const repo = { userExists: jest.fn(async () => true), getTicketForUpdate: jest.fn(async () => null) } as any;
    await expect(new TicketEscalationsService(pool, audit, repo).escalate(actor, 't1', { reason: 'sla breach' })).rejects.toBeInstanceOf(TicketNotFoundError);
  });
  it('404 when reassign target user is unknown (validated before the lock)', async () => {
    const { pool, audit } = harness();
    const repo = { userExists: jest.fn(async () => false), getTicketForUpdate: jest.fn() } as any;
    await expect(new TicketEscalationsService(pool, audit, repo).escalate(actor, 't1', { reassignToUserId: USER, reason: 'reassign' })).rejects.toBeInstanceOf(AssigneeNotFoundError);
    expect(repo.getTicketForUpdate).not.toHaveBeenCalled();
  });
  it('escalate: updates + audits old→new in-tx (with tenant context)', async () => {
    const { pool, audit, client } = harness();
    const repo = { userExists: jest.fn(async () => true), getTicketForUpdate: jest.fn(async () => ticket({ severity: 'P2', status: 'open' })), updateEscalation: jest.fn() } as any;
    const out: any = await new TicketEscalationsService(pool, audit, repo).escalate(actor, 't1', { severity: 'P0', reason: 'tenant SLA collapsing' });
    expect(out.severity).toBe('P0'); expect(out.status).toBe('escalated');
    expect(repo.updateEscalation).toHaveBeenCalledWith(client, 't1', expect.objectContaining({ severity: 'P0', status: 'escalated' }), 'admin1');
    expect(audit.write).toHaveBeenCalledWith(client, expect.objectContaining({ action: 'support.ticket_escalated', oldValue: expect.objectContaining({ tenantId: TENANT, severity: 'P2' }) }));
  });
  it('downgrade attempt throws + audits nothing', async () => {
    const { pool, audit } = harness();
    const repo = { userExists: jest.fn(async () => true), getTicketForUpdate: jest.fn(async () => ticket({ severity: 'P1', status: 'open' })), updateEscalation: jest.fn() } as any;
    await expect(new TicketEscalationsService(pool, audit, repo).escalate(actor, 't1', { severity: 'P3', reason: 'oops' })).rejects.toBeInstanceOf(InvalidEscalationError);
    expect(audit.write).not.toHaveBeenCalled();
  });
});
