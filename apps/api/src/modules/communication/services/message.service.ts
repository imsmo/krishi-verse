// modules/communication/services/message.service.ts · post + read + moderate chat messages.
// post: membership-gated (non-participant ⇒ 404), refuses a LOCKED thread (read under FOR UPDATE to avoid a
// race), writes the message + a MessagePosted outbox event (the notification fanout turns it into a push/in-app
// alert to the OTHER participants — recipientUserIds travel in the payload, never via a cross-module repo).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { uuidv7 } from '../../../core/database/uuid.util';
import { Message } from '../domain/message.entity';
import { DomainEvent, MessagingEventType } from '../domain/messaging.events';
import { MessageRepository } from '../repositories/message.repository';
import { ConversationRepository } from '../repositories/conversation.repository';
import { PostMessageDto } from '../dto/post-message.dto';
import { ConversationNotFoundError, MessageNotFoundError, ConversationLockedError, MessagingForbiddenError } from '../domain/messaging.errors';
import { MessagingActor } from './conversation.service';

@Injectable()
export class MessageService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly messages: MessageRepository,
    private readonly conversations: ConversationRepository,
  ) {}

  async post(tenantId: string, actor: MessagingActor, conversationId: string, idemKey: string, dto: PostMessageDto) {
    return this.idem.remember(idemKey, actor.userId, 'comm.message.post', () =>
      timed(this.metrics, 'comm.message.post', { tenant: tenantId }, () =>
        this.uow.run(tenantId, async (tx) => {
          const convo = await this.conversations.getForUpdate(tx, tenantId, conversationId);
          if (!convo) throw new ConversationNotFoundError(conversationId);
          if (!(await this.conversations.isParticipant(tenantId, conversationId, actor.userId, tx))) throw new ConversationNotFoundError(conversationId); // 404, no IDOR
          if (convo.isLocked) throw new ConversationLockedError(conversationId);
          const id = uuidv7();
          const msg = Message.post({ id, conversationId, tenantId, senderUserId: actor.userId, body: dto.body ?? null, voiceMediaId: dto.voiceMediaId ?? null, attachmentMediaId: dto.attachmentMediaId ?? null, isAiGenerated: false });
          await this.messages.insert(tx, msg);
          await this.conversations.markRead(tx, conversationId, actor.userId);   // the sender has "read" up to their own message
          // recipients = the other participants → carried in the event for the notification fanout
          const recipients = (await this.conversations.participantIds(tenantId, conversationId, tx)).filter((u) => u !== actor.userId);
          for (const e of msg.pullEvents()) {
            const payload = e.type === MessagingEventType.MessagePosted ? { v: 1, ...e.payload, recipientUserIds: recipients } : { v: 1, ...e.payload };
            await this.outbox.write(tx, { tenantId, aggregateType: 'message', aggregateId: id, eventType: e.type, payload });
          }
          return msg.toJSON();
        }, { userId: actor.userId })));
  }

  async list(tenantId: string, actor: MessagingActor, conversationId: string, q: { cursor?: { c: string; id: string }; limit: number }) {
    if (!(await this.conversations.isParticipant(tenantId, conversationId, actor.userId)) && !actor.isModerator) throw new ConversationNotFoundError(conversationId);
    const rows = await this.messages.listForConversation(tenantId, conversationId, q);
    const items = rows.map((m) => m.toJSON());
    const last = items[items.length - 1] as any;
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${last.createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }

  /** Flag a message for moderation. A participant may report; a moderator may also act. */
  async flag(tenantId: string, actor: MessagingActor, messageId: string) {
    return this.uow.run(tenantId, async (tx) => {
      const msg = await this.messages.getForUpdate(tx, tenantId, messageId);
      if (!msg) throw new MessageNotFoundError(messageId);
      if (!actor.isModerator && !(await this.conversations.isParticipant(tenantId, msg.conversationId, actor.userId, tx))) throw new MessageNotFoundError(messageId);
      msg.flag();
      await this.messages.update(tx, msg);
      await this.flush(tx, tenantId, messageId, msg.pullEvents());
      return msg.toJSON();
    }, { userId: actor.userId });
  }
  /** Moderator-only: clear a flag after review. */
  async unflag(tenantId: string, actor: MessagingActor, messageId: string) {
    if (!actor.isModerator) throw new MessagingForbiddenError('requires message.moderate');
    return this.uow.run(tenantId, async (tx) => {
      const msg = await this.messages.getForUpdate(tx, tenantId, messageId);
      if (!msg) throw new MessageNotFoundError(messageId);
      msg.unflag();
      await this.messages.update(tx, msg);
      return msg.toJSON();
    }, { userId: actor.userId });
  }
  private async flush(tx: TxContext, tenantId: string, id: string, evts: DomainEvent[]): Promise<void> {
    for (const e of evts) await this.outbox.write(tx, { tenantId, aggregateType: 'message', aggregateId: id, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
