// modules/communication/services/conversation.service.ts · open + manage chat threads.
// One ACID tx per write (UoW), outbox events in the SAME tx (Law 4), idempotent open (Law 3). Access is gated by
// PARTICIPANT membership resolved server-side — a non-participant read 404s (anti-IDOR). Locking needs an owner
// participant or message.moderate. The caller is ALWAYS added as a participant; client-supplied ids never grant
// the caller access to a thread they aren't in.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { uuidv7 } from '../../../core/database/uuid.util';
import { Conversation } from '../domain/conversation.entity';
import { DomainEvent, ContextType } from '../domain/messaging.events';
import { ConversationRepository } from '../repositories/conversation.repository';
import { OpenConversationDto } from '../dto/open-conversation.dto';
import { ConversationNotFoundError, MessagingForbiddenError } from '../domain/messaging.errors';

export interface MessagingActor { userId: string; isModerator: boolean; }

@Injectable()
export class ConversationService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly repo: ConversationRepository,
  ) {}

  async open(tenantId: string, actor: MessagingActor, idemKey: string, dto: OpenConversationDto) {
    return this.idem.remember(idemKey, actor.userId, 'comm.conversation.open', () =>
      timed(this.metrics, 'comm.conversation.open', { tenant: tenantId }, () =>
        this.uow.run(tenantId, async (tx) => {
          // idempotent for context-linked threads: reuse the existing one (caller must already belong to it)
          if (dto.contextType !== 'direct' && dto.contextId) {
            const existing = await this.repo.findByContext(tenantId, dto.contextType, dto.contextId, tx);
            if (existing) {
              if (!(await this.repo.isParticipant(tenantId, existing.id, actor.userId, tx))) throw new MessagingForbiddenError('not a participant of this context thread');
              return existing.toJSON();
            }
          }
          const id = uuidv7();
          const convo = Conversation.open({ id, tenantId, contextType: dto.contextType as ContextType, contextId: dto.contextId ?? null });
          await this.repo.insert(tx, convo);
          const others = [...new Set(dto.participantUserIds.filter((u) => u !== actor.userId))];
          await this.repo.addParticipants(tx, id, [{ userId: actor.userId, role: 'owner' }, ...others.map((u) => ({ userId: u, role: 'member' as const }))]);
          await this.flush(tx, tenantId, id, convo.pullEvents());
          return convo.toJSON();
        }, { userId: actor.userId })));
  }

  async getById(tenantId: string, actor: MessagingActor, id: string) {
    const c = await this.repo.getForParticipant(tenantId, actor.userId, id);
    if (!c) throw new ConversationNotFoundError(id);   // 404 for a non-participant (no IDOR)
    return c.toJSON();
  }
  async list(tenantId: string, actor: MessagingActor, q: { contextType?: string; cursor?: { c: string; id: string }; limit: number }) {
    const rows = await this.repo.listForUser(tenantId, actor.userId, q);
    const items = rows.map((c) => c.toJSON());
    const last = items[items.length - 1] as any;
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${last.createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }
  async markRead(tenantId: string, actor: MessagingActor, id: string) {
    return this.uow.run(tenantId, async (tx) => {
      if (!(await this.repo.isParticipant(tenantId, id, actor.userId, tx))) throw new ConversationNotFoundError(id);
      await this.repo.markRead(tx, id, actor.userId);
      return { ok: true };
    }, { userId: actor.userId });
  }
  async setLock(tenantId: string, actor: MessagingActor, id: string, locked: boolean) {
    return this.uow.run(tenantId, async (tx) => {
      const convo = await this.repo.getForUpdate(tx, tenantId, id);
      if (!convo) throw new ConversationNotFoundError(id);
      const role = await this.repo.participantRole(tenantId, id, actor.userId, tx);
      if (role === null && !actor.isModerator) throw new ConversationNotFoundError(id);     // not a participant ⇒ 404
      if (role !== 'owner' && !actor.isModerator) throw new MessagingForbiddenError('only the owner or a moderator may lock this thread');
      if (locked) convo.lock(); else convo.unlock();
      await this.repo.update(tx, convo);
      await this.flush(tx, tenantId, id, convo.pullEvents());
      return convo.toJSON();
    }, { userId: actor.userId });
  }
  private async flush(tx: TxContext, tenantId: string, id: string, evts: DomainEvent[]): Promise<void> {
    for (const e of evts) await this.outbox.write(tx, { tenantId, aggregateType: 'conversation', aggregateId: id, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
