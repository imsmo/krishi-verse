// modules/support/__tests__/support-domain.spec.ts · pure-domain invariants (no I/O).
// Pins: SLA due dates derived from severity at open; first-response stamped once; status machine (legal/illegal,
// resolve stamps resolvedAt, reopen clears it); CSAT only on resolved/closed + range 1-5.
import { SupportTicket } from '../domain/support-ticket.entity';
import { IllegalTicketTransitionError } from '../domain/support-ticket.state';
import { InvalidTicketError, TicketNotResolvedError } from '../domain/support.errors';

const open = (sev: any = 'P2', now = new Date('2026-06-20T00:00:00Z')) => SupportTicket.open({
  id: 't1', tenantId: 't', ticketNo: 'KV-T-1', requesterUserId: 'u1', channel: 'app', categoryId: null, severity: sev, subject: 'help', conversationId: null, now,
});

describe('SupportTicket.open + SLA', () => {
  it('derives first-response + resolution due from severity (P0 = 15m / 4h)', () => {
    const t = open('P0').toProps();
    expect(t.slaFirstResponseDue!.getTime()).toBe(new Date('2026-06-20T00:15:00Z').getTime());
    expect(t.slaResolutionDue!.getTime()).toBe(new Date('2026-06-20T04:00:00Z').getTime());
  });
  it('requires a subject or category', () => {
    expect(() => SupportTicket.open({ id: 't', tenantId: 't', ticketNo: 'n', requesterUserId: 'u', channel: 'app', categoryId: null, severity: 'P2', subject: null, conversationId: null })).toThrow(InvalidTicketError);
  });
});

describe('first response + lifecycle', () => {
  it('stamps first_responded_at once', () => {
    const t = open(); t.pullEvents(); t.recordFirstResponse(); expect(t.toProps().firstRespondedAt).toBeTruthy();
    const first = t.toProps().firstRespondedAt; t.recordFirstResponse(); expect(t.toProps().firstRespondedAt).toBe(first);
  });
  it('open→resolved stamps resolvedAt; resolved→closed; closed→reopened clears resolvedAt+csat', () => {
    const t = open(); t.transition('resolved'); expect(t.toProps().resolvedAt).toBeTruthy();
    t.submitCsat(5); expect(t.toProps().csatScore).toBe(5);
    t.transition('closed'); expect(t.status).toBe('closed');
    t.transition('reopened'); expect(t.status).toBe('reopened'); expect(t.toProps().resolvedAt).toBeNull(); expect(t.toProps().csatScore).toBeNull();
  });
  it('rejects an illegal jump (open→closed)', () => { expect(() => open().transition('closed')).toThrow(IllegalTicketTransitionError); });
});

describe('CSAT', () => {
  it('only on resolved/closed; range 1-5', () => {
    expect(() => open().submitCsat(5)).toThrow(TicketNotResolvedError);
    const t = open(); t.transition('resolved');
    expect(() => t.submitCsat(0)).toThrow(InvalidTicketError);
    expect(() => t.submitCsat(6)).toThrow(InvalidTicketError);
  });
});
