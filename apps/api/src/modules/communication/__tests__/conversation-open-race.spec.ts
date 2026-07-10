// modules/communication/__tests__/conversation-open-race.spec.ts · S3 review follow-up (migration 0063).
// uq_conversations_context_1to1 backs a "one thread per (tenant, contextType, contextId)" invariant for the
// genuinely 1:1 context types (order/requirement/dispute/booking/support_ticket) that ConversationService.open()
// already assumed but never had a DB constraint for — two concurrent opens for the SAME context could both miss
// the findByContext read and each try to insert, racing on 23505. Fix: catch the unique violation on insert,
// re-fetch via findByContext, and hand back the row the other request just committed (mirrors the 23505-on-race
// handling in identity's OnboardingService.grantRole). 'direct'/'listing' are MULTI-thread (MULTI_THREAD_CONTEXT_
// TYPES) and carry no such constraint — the catch must never engage for them.
import { ConversationService } from '../services/conversation.service';
import { Conversation } from '../domain/conversation.entity';
import { MessagingForbiddenError } from '../domain/messaging.errors';

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
    insert: jest.fn(),
    addParticipants: jest.fn().mockResolvedValue(undefined),
  };
  const svc = new ConversationService(uow as any, outbox as any, idem as any, metrics as any, repo as any);
  return { svc, repo };
}

const uniqueViolation = Object.assign(new Error('duplicate key value violates unique constraint "uq_conversations_context_1to1"'), { code: '23505' });

describe("ConversationService.open — race-safe on uq_conversations_context_1to1 (migration 0063)", () => {
  it('a 1:1 context (order) loses the create race → catches 23505, re-fetches, returns the row the winner inserted', async () => {
    const { svc, repo } = harness();
    const winner = Conversation.rehydrate({ id: 'c-winner', tenantId: 't1', contextType: 'order', contextId: 'o1', isLocked: false });
    // first read: no thread yet (this caller lost the race to see it)
    repo.findByContext.mockResolvedValueOnce(null);
    repo.insert.mockRejectedValueOnce(uniqueViolation);
    // re-fetch after the 23505: the other request's row is now visible
    repo.findByContext.mockResolvedValueOnce(winner);

    const out = await svc.open('t1', { userId: 'u1', isModerator: false }, 'idem-race-1', { contextType: 'order', contextId: 'o1', participantUserIds: ['u2'] } as any);

    expect(out.id).toBe('c-winner');
    expect(repo.findByContext).toHaveBeenCalledTimes(2);
    // S4 REVIEW FIX pin: the recovery re-fetch must run OFF-TX — the 23505 aborted the transaction,
    // so any query still bound to `tx` would throw 25P02 on real Postgres. Assert no tx arg (4th param).
    expect(repo.findByContext.mock.calls[1][3]).toBeUndefined();
    expect(repo.addParticipants).not.toHaveBeenCalled(); // never runs post-insert side effects for the row we didn't create
  });

  it('the loser must still be a participant of the winning thread — a non-participant race loser gets MessagingForbiddenError, not the thread', async () => {
    const { svc, repo } = harness();
    const winner = Conversation.rehydrate({ id: 'c-winner', tenantId: 't1', contextType: 'order', contextId: 'o1', isLocked: false });
    repo.findByContext.mockResolvedValueOnce(null);
    repo.insert.mockRejectedValueOnce(uniqueViolation);
    repo.findByContext.mockResolvedValueOnce(winner);
    repo.isParticipant.mockResolvedValueOnce(false);

    await expect(svc.open('t1', { userId: 'outsider', isModerator: false }, 'idem-race-2', { contextType: 'order', contextId: 'o1', participantUserIds: ['u2'] } as any))
      .rejects.toBeInstanceOf(MessagingForbiddenError);
  });

  it('if the re-fetch somehow finds nothing (edge case), the original 23505 propagates rather than being swallowed', async () => {
    const { svc, repo } = harness();
    repo.findByContext.mockResolvedValueOnce(null);
    repo.insert.mockRejectedValueOnce(uniqueViolation);
    repo.findByContext.mockResolvedValueOnce(null); // re-fetch finds nothing — shouldn't happen, but fail loud

    await expect(svc.open('t1', { userId: 'u1', isModerator: false }, 'idem-race-3', { contextType: 'order', contextId: 'o1', participantUserIds: ['u2'] } as any))
      .rejects.toBe(uniqueViolation);
  });

  it("multi-thread contexts ('listing'/'direct') are unaffected: a 23505 on insert is NEVER caught for them, it just propagates", async () => {
    const { svc: svcListing, repo: repoListing } = harness();
    repoListing.findByContextForActor.mockResolvedValue(null);
    repoListing.insert.mockRejectedValueOnce(uniqueViolation);
    await expect(svcListing.open('t1', { userId: 'buyer-A', isModerator: false }, 'idem-race-4', { contextType: 'listing', contextId: 'L1', participantUserIds: ['seller-1'] } as any))
      .rejects.toBe(uniqueViolation);
    expect(repoListing.findByContext).not.toHaveBeenCalled(); // no 1:1 re-fetch path exists for 'listing'

    const { svc: svcDirect, repo: repoDirect } = harness();
    repoDirect.insert.mockRejectedValueOnce(uniqueViolation);
    await expect(svcDirect.open('t1', { userId: 'u1', isModerator: false }, 'idem-race-5', { contextType: 'direct', contextId: 'L1', participantUserIds: ['u2'] } as any))
      .rejects.toBe(uniqueViolation);
    expect(repoDirect.findByContext).not.toHaveBeenCalled();
  });

  it('the happy path (no race) is unaffected: insert succeeds, addParticipants + flush still run', async () => {
    const { svc, repo } = harness();
    repo.findByContext.mockResolvedValueOnce(null);
    repo.insert.mockResolvedValueOnce(undefined);
    const out = await svc.open('t1', { userId: 'u1', isModerator: false }, 'idem-race-6', { contextType: 'order', contextId: 'o2', participantUserIds: ['u2'] } as any);
    expect(repo.insert).toHaveBeenCalledTimes(1);
    expect(repo.addParticipants).toHaveBeenCalledTimes(1);
    expect(out.contextType).toBe('order');
  });
});
