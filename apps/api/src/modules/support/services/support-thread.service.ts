// modules/support/services/support-thread.service.ts · 03_API_CONTRACT_DELTA.md §520 (screen 520,
// KV-BL-034/052 sibling, PILOT-BLOCKING). GET /v1/support/tickets/:id/thread — lazily creates (server-side, on
// first call) or returns the existing `conversations` row linked to this ticket; the client then uses the
// EXISTING communication conversations/:id/messages GET/POST for the actual two-way chat (this endpoint is
// glue only, never a new chat system — support-ticket.service.ts::respond() only ever stamped an SLA
// timestamp, no message body, no messages table; see 03_API_CONTRACT_DELTA.md's contradiction #2).
//
// Participants = the ticket's requester + its assigned agent. Support's assignment model (support-ticket.state
// + support-ticket.entity's `assign()`) has EXACTLY ONE assignee per ticket (assigneeUserId: string | null on
// SupportTicketProps) — no multi-agent queue/round-robin in this codebase today (support.module.ts's own DEFERRED
// note confirms "auto-routing/round-robin assignment" is out of scope). So "assigned agent" unambiguously means
// that one column; unassigned ⇒ requester-only until an agent is assigned (re-opening the thread later would
// need a fresh call after assignment — out of scope for this pass, same as the rest of the lazy-create design).
//
// Cross-module: reuses communication's ConversationService (Law 11 — via its EXPORTED service, never its
// repository/table), the exact same convention already established by
// modules/listings/services/listing-inquiry.service.ts for KV-BL-031.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../core/database/unit-of-work';
import { SupportTicketRepository } from '../repositories/support-ticket.repository';
import { SupportActor } from './support-ticket.service';
import { TicketNotFoundError, InvalidTicketError } from '../domain/support.errors';
import { ConversationService } from '../../communication/services/conversation.service';

@Injectable()
export class SupportThreadService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    private readonly tickets: SupportTicketRepository,
    private readonly conversations: ConversationService,
  ) {}

  /** Idempotent lazy-create. 'support_ticket' is a genuinely 1:1 context type (NOT in communication's
   *  MULTI_THREAD_CONTEXT_TYPES), so ConversationService.open() ALREADY finds + reuses the same conversation on
   *  every call after the first via its own findByContext(tenantId, 'support_ticket', ticketId) check — that is
   *  the primary idempotency guard. This method also links the result onto support_tickets.conversation_id
   *  (idempotent, first-writer-wins) as a fast path for repeat calls and to fulfil the column's own intent
   *  (migration 0012) — it is a convenience cache of the lookup, not the sole source of truth for reuse.
   *
   *  KNOWN LIMITATION (shared with the rest of this codebase, not specific to this bridge): two GENUINELY
   *  simultaneous first-ever calls could each miss the other's in-flight findByContext check before either
   *  transaction commits, in principle creating two conversation rows for the same ticket. This is the same
   *  latent race ConversationService.open() already has for every other 1:1 context type (order/requirement/
   *  dispute/booking) — not solved here, flagged for the reviewer/S4 if it needs a stronger guard (e.g. a
   *  unique index on conversations(tenant_id, context_type, context_id) plus ON CONFLICT). */
  async getOrCreateThread(tenantId: string, actor: SupportActor, ticketId: string): Promise<{ conversationId: string }> {
    const t = await this.tickets.getById(tenantId, ticketId);
    if (!t) throw new TicketNotFoundError(ticketId);
    const v = t.toProps();

    // Requester-or-agent-only (anti-IDOR 404) — SAME access convention as SupportTicketService.getById/list:
    // any support.handle agent may open any ticket's thread, a stranger 404s (never confirms the ticket exists).
    if (v.requesterUserId !== actor.userId && !actor.isAgent) throw new TicketNotFoundError(ticketId);

    if (v.conversationId) return { conversationId: v.conversationId };   // second call — already linked, fast path

    // Participants = requester + assigned agent; unassigned ⇒ requester-only (03_API_CONTRACT_DELTA.md §520).
    const requesterId = v.requesterUserId;
    const assigneeId = v.assigneeUserId;
    const ownerId = requesterId ?? assigneeId;
    if (!ownerId) throw new InvalidTicketError('ticket has no requester or assignee to open a thread for');
    const others = [assigneeId].filter((id): id is string => !!id && id !== ownerId);

    // Deterministic idempotency key scoped to this ticket (ConversationService.open() itself de-dupes on
    // (idemKey, userId, action) via idem.remember AND on (tenantId, contextType, contextId) via findByContext).
    const convo = await this.conversations.open(
      tenantId,
      { userId: ownerId, isModerator: false },
      `support-thread:${ticketId}`,
      { contextType: 'support_ticket', contextId: ticketId, participantUserIds: others },
    );

    await this.uow.run(tenantId, (tx) => this.tickets.linkConversation(tx, tenantId, ticketId, convo.id), { userId: ownerId });
    return { conversationId: convo.id };
  }
}
