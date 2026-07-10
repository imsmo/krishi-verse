// modules/support/__tests__/support-thread.service.spec.ts · 03_API_CONTRACT_DELTA.md §520 thread bridge.
// Pins: lazy-create opens a conversation with requester+assignee as participants and links it onto the ticket;
// a second call (conversation_id already set) returns the SAME id without re-opening a conversation; a stranger
// (non-requester, non-agent) 404s (no IDOR); an unassigned ticket opens a requester-only thread.
import { SupportThreadService } from '../services/support-thread.service';
import { SupportTicket } from '../domain/support-ticket.entity';
import { TicketNotFoundError, InvalidTicketError } from '../domain/support.errors';

const ticket = (over: Partial<any> = {}) => SupportTicket.rehydrate({
  id: 't1', tenantId: 'ten1', ticketNo: 'KV-T-1', requesterUserId: 'req', channel: 'app', categoryId: null,
  severity: 'P2', subject: 'x', status: 'open', assigneeUserId: null, conversationId: null,
  slaFirstResponseDue: null, slaResolutionDue: null, firstRespondedAt: null, resolvedAt: null, csatScore: null,
  ...over,
});

function harness(opts: { ticket?: SupportTicket | null } = {}) {
  const tx = { query: jest.fn() };
  const uow = { run: jest.fn(async (_t: string, fn: any) => fn(tx)) };
  const tickets = {
    getById: jest.fn(async () => opts.ticket ?? null),
    linkConversation: jest.fn(async () => undefined),
  };
  const conversations = { open: jest.fn(async (_tenantId: string, _actor: any, _key: string, dto: any) => ({ id: 'convo-new', contextType: dto.contextType, contextId: dto.contextId, isLocked: false })) };
  const svc = new SupportThreadService(uow as any, tickets as any, conversations as any);
  return { svc, tickets, conversations, uow };
}

const requester = { userId: 'req', isAgent: false };
const agent = { userId: 'agt', isAgent: true };
const stranger = { userId: 'stranger', isAgent: false };

describe('SupportThreadService.getOrCreateThread', () => {
  it('lazily creates a thread with requester+assignee as participants and links it onto the ticket', async () => {
    const h = harness({ ticket: ticket({ assigneeUserId: 'agt' }) });
    const out = await h.svc.getOrCreateThread('ten1', requester, 't1');
    expect(out).toEqual({ conversationId: 'convo-new' });
    expect(h.conversations.open).toHaveBeenCalledWith(
      'ten1', { userId: 'req', isModerator: false }, 'support-thread:t1',
      { contextType: 'support_ticket', contextId: 't1', participantUserIds: ['agt'] },
    );
    expect(h.tickets.linkConversation).toHaveBeenCalledWith(expect.anything(), 'ten1', 't1', 'convo-new');
  });

  it('second call returns the SAME conversationId without opening a new conversation', async () => {
    const h = harness({ ticket: ticket({ assigneeUserId: 'agt', conversationId: 'convo-existing' }) });
    const out = await h.svc.getOrCreateThread('ten1', requester, 't1');
    expect(out).toEqual({ conversationId: 'convo-existing' });
    expect(h.conversations.open).not.toHaveBeenCalled();
    expect(h.tickets.linkConversation).not.toHaveBeenCalled();
  });

  it('a stranger (non-requester, non-agent) gets 404 — no IDOR', async () => {
    const h = harness({ ticket: ticket() });
    await expect(h.svc.getOrCreateThread('ten1', stranger, 't1')).rejects.toBeInstanceOf(TicketNotFoundError);
    expect(h.conversations.open).not.toHaveBeenCalled();
  });

  it('an agent (support.handle) may open the thread even if not the assignee — same access convention as getById', async () => {
    const h = harness({ ticket: ticket({ assigneeUserId: null }) });
    const out = await h.svc.getOrCreateThread('ten1', agent, 't1');
    expect(out).toEqual({ conversationId: 'convo-new' });
  });

  it('unassigned ticket opens a requester-only thread (no participants beyond the owner)', async () => {
    const h = harness({ ticket: ticket({ assigneeUserId: null }) });
    await h.svc.getOrCreateThread('ten1', requester, 't1');
    expect(h.conversations.open).toHaveBeenCalledWith(
      'ten1', { userId: 'req', isModerator: false }, 'support-thread:t1',
      { contextType: 'support_ticket', contextId: 't1', participantUserIds: [] },
    );
  });

  it('a missing ticket 404s', async () => {
    const h = harness({ ticket: null });
    await expect(h.svc.getOrCreateThread('ten1', requester, 'missing')).rejects.toBeInstanceOf(TicketNotFoundError);
  });

  it('throws InvalidTicketError if the ticket has neither a requester nor an assignee (defensive)', async () => {
    const h = harness({ ticket: ticket({ requesterUserId: null, assigneeUserId: null }) });
    await expect(h.svc.getOrCreateThread('ten1', agent, 't1')).rejects.toBeInstanceOf(InvalidTicketError);
  });
});
