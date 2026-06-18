// modules/requirements/__tests__/requirement.service.spec.ts · pure-domain unit tests: both state
// machines (Law 5) + the Requirement and RequirementResponse aggregates (post/quote guards, turn,
// accept rules). The services' UoW/outbox/authz are covered by the integration spec.
import * as RS from '../domain/requirement.state';
import * as PS from '../domain/requirement-response.state';
import { Requirement } from '../domain/requirement.entity';
import { RequirementResponse } from '../domain/requirement-response.entity';
import { RequirementEventType, ResponseEventType } from '../domain/requirements.events';
import { InvalidRequirementError, RequirementNotOpenError, InvalidResponseError, ResponseNotLiveError, ResponseNotAcceptableError } from '../domain/requirements.errors';

const FUTURE = new Date('2030-01-01T00:00:00Z');
const NOW = new Date('2026-06-01T00:00:00Z');
const req = (over: any = {}) => Requirement.post({ id: 'r1', tenantId: 't1', buyerUserId: 'buyer1', title: 'Need wheat', quantity: '50', unitCode: 'quintal', now: NOW, ...over });
const resp = (over: any = {}) => RequirementResponse.submit({ id: 'q1', requirementId: 'r1', tenantId: 't1', sellerUserId: 'seller1', listingId: 'l1', quotedPriceMinor: 90000n, quantity: '50', now: NOW, ...over });

describe('requirement.state machine', () => {
  it('allows documented transitions, forbids illegal ones', () => {
    expect(RS.canTransition('open', 'partially_matched')).toBe(true);
    expect(RS.canTransition('open', 'fulfilled')).toBe(true);
    expect(RS.canTransition('partially_matched', 'fulfilled')).toBe(true);
    expect(RS.canTransition('fulfilled', 'open')).toBe(false);
    expect(RS.isAcceptingResponses('open')).toBe(true); expect(RS.isAcceptingResponses('partially_matched')).toBe(true); expect(RS.isAcceptingResponses('fulfilled')).toBe(false);
    expect(RS.isTerminal('closed')).toBe(true); expect(RS.isTerminal('expired')).toBe(true);
  });
  it('covers every status', () => { for (const s of RS.REQUIREMENT_STATUSES) expect(() => RS.canTransition(s, 'closed' as any)).not.toThrow(); });
});

describe('requirement-response.state machine', () => {
  it('allows documented transitions, forbids illegal ones', () => {
    expect(PS.canTransition('submitted', 'shortlisted')).toBe(true);
    expect(PS.canTransition('submitted', 'accepted')).toBe(true);
    expect(PS.canTransition('shortlisted', 'accepted')).toBe(true);
    expect(PS.canTransition('accepted', 'rejected')).toBe(false);
    expect(PS.isLive('submitted')).toBe(true); expect(PS.isLive('accepted')).toBe(false);
  });
  it('covers every status', () => { for (const s of PS.RESPONSE_STATUSES) expect(() => PS.canTransition(s, 'rejected' as any)).not.toThrow(); });
});

describe('Requirement.post', () => {
  it('rejects bad quantity, empty title, and inverted budget', () => {
    expect(() => req({ quantity: '0' })).toThrow(InvalidRequirementError);
    expect(() => req({ title: '   ' })).toThrow(InvalidRequirementError);
    expect(() => req({ budgetMinMinor: 200000n, budgetMaxMinor: 100000n })).toThrow(InvalidRequirementError);
  });
  it('starts open and emits requirement_posted', () => {
    const r = req();
    expect(r.status).toBe('open');
    expect(r.pullEvents().map((e) => e.type)).toContain(RequirementEventType.Posted);
  });
});

describe('Requirement lifecycle', () => {
  it('shortlist moves open → partially_matched (idempotent thereafter)', () => {
    const r = req(); r.pullEvents();
    r.markPartiallyMatched(); expect(r.status).toBe('partially_matched');
    r.markPartiallyMatched(); expect(r.status).toBe('partially_matched');   // no-op, no throw
  });
  it('fulfil / close / expire respect the machine', () => {
    expect(req().status).toBe('open');
    const a = req(); a.fulfill('q1'); expect(a.status).toBe('fulfilled');
    expect(() => a.close()).toThrow(RequirementNotOpenError);                // terminal
    const b = req(); b.close(); expect(b.status).toBe('closed');
    const c = req(); c.expire(); expect(c.status).toBe('expired');
  });
});

describe('RequirementResponse', () => {
  it('rejects bad price/qty and a past validUntil', () => {
    expect(() => resp({ quotedPriceMinor: 0n })).toThrow(InvalidResponseError);
    expect(() => resp({ quantity: '0' })).toThrow(InvalidResponseError);
    expect(() => resp({ validUntil: new Date(NOW.getTime() - 1000) })).toThrow(InvalidResponseError);
  });
  it('submitted → shortlisted → accepted carries the order inputs (buyer, price, qty, listing)', () => {
    const q = resp(); q.pullEvents();
    q.shortlist(); expect(q.status).toBe('shortlisted');
    q.accept('buyer1', NOW);
    expect(q.status).toBe('accepted');
    const ev = q.pullEvents().find((e) => e.type === ResponseEventType.Accepted)!;
    expect(ev.payload).toMatchObject({ buyerUserId: 'buyer1', sellerUserId: 'seller1', listingId: 'l1', quotedPriceMinor: '90000', quantity: '50' });
  });
  it('cannot be accepted without a listing, when expired, or when not live', () => {
    expect(() => resp({ listingId: null }).accept('buyer1', NOW)).toThrow(ResponseNotAcceptableError);
    const expired = resp({ validUntil: new Date(NOW.getTime() + 1000) });
    expect(() => expired.accept('buyer1', new Date(NOW.getTime() + 2000))).toThrow(ResponseNotLiveError);
    const r = resp(); r.reject();
    expect(() => r.accept('buyer1', NOW)).toThrow(ResponseNotLiveError);
  });
});
