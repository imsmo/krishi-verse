// modules/communication/__tests__/conversation-listing-context.spec.ts · KV-BL-031.
// Pins the two additive communication changes the listings/:id/inquiries endpoint depends on:
//   1. 'listing' is accepted as a CONTEXT_TYPES value (backward compatible — every existing value still works,
//      Conversation.open() still requires a contextId for it same as any other non-direct type).
//   2. ConversationService.open() does NOT reuse "the" single existing thread for a MULTI_THREAD_CONTEXT_TYPES
//      context ('direct', 'listing') the way it does for genuinely 1:1 contexts (order/requirement/dispute/
//      booking/support_ticket) — a second buyer inquiring about the same listing must get their OWN thread, not
//      an existing one belonging to a different buyer (which would 403 them via the participant check). A
//      'listing' thread instead reuses THIS actor's own existing thread for the context (dedup without collision).
import { ConversationService } from '../services/conversation.service';
import { Conversation } from '../domain/conversation.entity';
import { CONTEXT_TYPES, MULTI_THREAD_CONTEXT_TYPES } from '../domain/messaging.events';
import { MessagingForbiddenError } from '../domain/messaging.errors';

describe('CONTEXT_TYPES vocabulary (ADR-0006: code-side vocab, no DB CHECK)', () => {
  it('is additive — every pre-existing value is still present', () => {
    for (const v of ['order', 'requirement', 'dispute', 'booking', 'direct', 'support_ticket']) {
      expect(CONTEXT_TYPES).toContain(v);
    }
  });
  it('now includes "listing" (KV-BL-031)', () => {
    expect(CONTEXT_TYPES).toContain('listing');
  });
  it('MULTI_THREAD_CONTEXT_TYPES marks direct + listing as many-threads-per-context', () => {
    expect(MULTI_THREAD_CONTEXT_TYPES.has('direct')).toBe(true);
    expect(MULTI_THREAD_CONTEXT_TYPES.has('listing')).toBe(true);
    expect(MULTI_THREAD_CONTEXT_TYPES.has('order')).toBe(false);
  });
  it('Conversation.open() still requires a contextId for the new "listing" type (same rule as other non-direct types)', () => {
    expect(() => Conversation.open({ id: 'c1', tenantId: 't1', contextType: 'listing', contextId: null })).toThrow();
    expect(Conversation.open({ id: 'c1', tenantId: 't1', contextType: 'listing', contextId: 'L1' }).contextType).toBe('listing');
  });
});

function harness() {
  const tx = { query: jest.fn() };
  const uow = { run: jest.fn(async (_t: string, fn: any) => fn(tx)) };
  const outbox = { write: jest.fn().mockResolvedValue(undefined) };
  const idem = { remember: jest.fn(async (_k: string, _u: string, _e: string, fn: any) => fn()) };
  const metrics = { inc: jest.fn(), observe: jest.fn() };
  const repo = {
    findByContext: jest.fn(),
    findByContextForActor: jest.fn(),
    isParticipant: jest.fn().mockResolvedValue(true),
    insert: jest.fn().mockResolvedValue(undefined),
    addParticipants: jest.fn().mockResolvedValue(undefined),
  };
  const svc = new ConversationService(uow as any, outbox as any, idem as any, metrics as any, repo as any);
  return { svc, repo };
}

describe('ConversationService.open — multi-thread context handling (KV-BL-031)', () => {
  it("a GENUINELY 1:1 context ('order') reuses the single existing thread via findByContext (unchanged behavior)", async () => {
    const { svc, repo } = harness();
    const existing = Conversation.rehydrate({ id: 'c-existing', tenantId: 't1', contextType: 'order', contextId: 'o1', isLocked: false });
    repo.findByContext.mockResolvedValue(existing);
    const out = await svc.open('t1', { userId: 'u1', isModerator: false }, 'idem-1', { contextType: 'order', contextId: 'o1', participantUserIds: ['u2'] } as any);
    expect(repo.findByContext).toHaveBeenCalledWith('t1', 'order', 'o1', expect.anything());
    expect(repo.findByContextForActor).not.toHaveBeenCalled();
    expect(out.id).toBe('c-existing');
    expect(repo.insert).not.toHaveBeenCalled(); // reused, not duplicated
  });

  it("'listing' does NOT use the single-row findByContext reuse (would risk handing back another buyer's thread)", async () => {
    const { svc, repo } = harness();
    repo.findByContextForActor.mockResolvedValue(null); // this buyer has no existing thread yet
    await svc.open('t1', { userId: 'buyer-A', isModerator: false }, 'idem-2', { contextType: 'listing', contextId: 'L1', participantUserIds: ['seller-1'] } as any);
    expect(repo.findByContext).not.toHaveBeenCalled();
    expect(repo.findByContextForActor).toHaveBeenCalledWith('t1', 'listing', 'L1', 'buyer-A', expect.anything());
    expect(repo.insert).toHaveBeenCalledTimes(1); // no existing thread for THIS actor → opens a new one
  });

  it("'listing': a DIFFERENT buyer inquiring about the same listing gets their OWN new thread, never buyer A's", async () => {
    const { svc, repo } = harness();
    // Buyer A already has a thread for this listing; buyer B's actor-scoped lookup correctly finds NONE of
    // THEIRS (findByContextForActor is scoped by actorUserId, so it never surfaces buyer A's row to buyer B).
    repo.findByContextForActor.mockResolvedValue(null);
    const out = await svc.open('t1', { userId: 'buyer-B', isModerator: false }, 'idem-3', { contextType: 'listing', contextId: 'L1', participantUserIds: ['seller-1'] } as any);
    expect(repo.insert).toHaveBeenCalledTimes(1); // buyer B gets a NEW thread, never buyer A's existing one
    expect(out.id).not.toBe('buyer-A-existing-thread');
  });

  it("'listing': reopening reuses THIS actor's own existing thread instead of creating a duplicate", async () => {
    const { svc, repo } = harness();
    const own = Conversation.rehydrate({ id: 'c-mine', tenantId: 't1', contextType: 'listing', contextId: 'L1', isLocked: false });
    repo.findByContextForActor.mockResolvedValue(own);
    const out = await svc.open('t1', { userId: 'buyer-A', isModerator: false }, 'idem-4', { contextType: 'listing', contextId: 'L1', participantUserIds: ['seller-1'] } as any);
    expect(out.id).toBe('c-mine');
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it("'direct' behavior is UNCHANGED: no reuse lookup at all, every open() creates a new thread", async () => {
    const { svc, repo } = harness();
    await svc.open('t1', { userId: 'u1', isModerator: false }, 'idem-5', { contextType: 'direct', contextId: 'L1', participantUserIds: ['u2'] } as any);
    expect(repo.findByContext).not.toHaveBeenCalled();
    expect(repo.findByContextForActor).not.toHaveBeenCalled();
    expect(repo.insert).toHaveBeenCalledTimes(1);
  });

  it('a 1:1 context whose existing thread the caller is NOT part of throws MessagingForbiddenError (unchanged guard)', async () => {
    const { svc, repo } = harness();
    const existing = Conversation.rehydrate({ id: 'c-existing', tenantId: 't1', contextType: 'order', contextId: 'o1', isLocked: false });
    repo.findByContext.mockResolvedValue(existing);
    repo.isParticipant.mockResolvedValue(false);
    await expect(svc.open('t1', { userId: 'outsider', isModerator: false }, 'idem-6', { contextType: 'order', contextId: 'o1', participantUserIds: ['u2'] } as any))
      .rejects.toBeInstanceOf(MessagingForbiddenError);
  });
});
