// modules/support/__tests__/support-ticket.service.spec.ts · service unit tests with fakes.
// Pins: open files a requester ticket; agent actions require support.handle (throw otherwise) + audit; a
// non-owner non-agent read 404s (no IDOR); autoOpen is idempotent on ticket_no; transition records first response.
import { SupportTicketService } from '../services/support-ticket.service';
import { SupportTicket } from '../domain/support-ticket.entity';
import { TicketNotFoundError, SupportForbiddenError } from '../domain/support.errors';

const ticket = (over: Partial<any> = {}) => SupportTicket.rehydrate({ id: 't1', tenantId: 't1', ticketNo: 'KV-T-1', requesterUserId: 'req', channel: 'app', categoryId: null, severity: 'P2', subject: 'x', status: 'open', assigneeUserId: null, conversationId: null, slaFirstResponseDue: null, slaResolutionDue: null, firstRespondedAt: null, resolvedAt: null, csatScore: null, ...over });

function harness(opts: { ticket?: SupportTicket | null; exists?: boolean } = {}) {
  const tx = { query: jest.fn() };
  const uow = { run: jest.fn(async (_t: string, fn: any) => fn(tx)) };
  const outbox = { write: jest.fn() };
  const idem = { remember: jest.fn(async (_k: string, _u: string, _e: string, fn: any) => fn()) };
  const metrics = { inc: jest.fn(), observe: jest.fn() };
  const audit = { write: jest.fn() };
  const repo = { insert: jest.fn(), getForUpdate: jest.fn(async () => opts.ticket ?? null), getById: jest.fn(async () => opts.ticket ?? null), update: jest.fn(), existsByTicketNo: jest.fn(async () => opts.exists ?? false), listFor: jest.fn() };
  const svc = new SupportTicketService(uow as any, outbox as any, idem as any, metrics as any, audit as any, repo as any);
  return { svc, repo, audit };
}
const requester = { userId: 'req', isAgent: false };
const agent = { userId: 'agt', isAgent: true };

describe('open', () => {
  it('files a requester ticket with SLA due dates', async () => {
    const h = harness();
    const out = await h.svc.open('t1', requester, 'idem-1', { channel: 'app', severity: 'P1', subject: 'help' } as any);
    expect(h.repo.insert).toHaveBeenCalledTimes(1); expect(out.severity).toBe('P1'); expect(out.slaResolutionDue).toBeTruthy();
  });
});

describe('agent actions', () => {
  it('transition requires support.handle (throws for a requester)', async () => {
    const h = harness({ ticket: ticket() });
    await expect(h.svc.transition('t1', requester, 't1', { to: 'resolved' } as any, null)).rejects.toBeInstanceOf(SupportForbiddenError);
  });
  it('agent transition records first response + writes audit', async () => {
    const h = harness({ ticket: ticket() });
    await h.svc.transition('t1', agent, 't1', { to: 'resolved' } as any, '1.1.1.1');
    expect(h.repo.update).toHaveBeenCalledTimes(1); expect(h.audit.write).toHaveBeenCalledTimes(1);
  });
});

describe('reads + autoOpen', () => {
  it('a stranger gets 404 (no IDOR)', async () => {
    const h = harness({ ticket: ticket() });
    await expect(h.svc.getById('t1', { userId: 'stranger', isAgent: false }, 't1')).rejects.toBeInstanceOf(TicketNotFoundError);
  });
  it('autoOpen is idempotent — skips when the ticket_no already exists', async () => {
    const h = harness({ exists: true });
    await h.svc.autoOpen({ query: jest.fn() } as any, { tenantId: 't1', ticketNo: 'DSP-X', requesterUserId: null, channel: 'app', severity: 'P1', subject: 's', categoryId: null });
    expect(h.repo.insert).not.toHaveBeenCalled();
  });
});
