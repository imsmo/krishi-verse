// modules/communication/domain/message.entity.ts · the messages aggregate (append-only, partitioned by created_at).
// A message must carry SOMETHING (body | voice | attachment). senderUserId NULL = system/AI; is_ai_generated
// drives the transparency badge; is_flagged is the abuse-moderation flag (the only mutable field).
import { DomainEvent, MessagingEventType } from './messaging.events';
import { EmptyMessageError } from './messaging.errors';

export interface MessageProps {
  id: string; conversationId: string; tenantId: string; senderUserId: string | null; body: string | null;
  voiceMediaId: string | null; attachmentMediaId: string | null; isAiGenerated: boolean; isFlagged: boolean; createdAt?: Date;
}
export class Message {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: MessageProps) {}

  static post(input: Omit<MessageProps, 'isFlagged'>): Message {
    if (!input.body && !input.voiceMediaId && !input.attachmentMediaId) throw new EmptyMessageError();
    const m = new Message({ ...input, isFlagged: false });
    m.events.push({ type: MessagingEventType.MessagePosted, payload: { messageId: m.props.id, conversationId: m.props.conversationId, senderUserId: m.props.senderUserId, isAiGenerated: m.props.isAiGenerated } });
    return m;
  }
  static rehydrate(p: MessageProps): Message { return new Message(p); }
  get id() { return this.props.id; }
  get conversationId() { return this.props.conversationId; }
  get senderUserId() { return this.props.senderUserId; }
  get isFlagged() { return this.props.isFlagged; }
  toProps(): Readonly<MessageProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  flag(): void { if (this.props.isFlagged) return; this.props.isFlagged = true; this.events.push({ type: MessagingEventType.MessageFlagged, payload: { messageId: this.props.id, conversationId: this.props.conversationId } }); }
  unflag(): void { this.props.isFlagged = false; }
  toJSON() {
    const v = this.props;
    return { id: v.id, conversationId: v.conversationId, senderUserId: v.senderUserId, body: v.body, voiceMediaId: v.voiceMediaId, attachmentMediaId: v.attachmentMediaId, isAiGenerated: v.isAiGenerated, isFlagged: v.isFlagged, createdAt: v.createdAt };
  }
}
