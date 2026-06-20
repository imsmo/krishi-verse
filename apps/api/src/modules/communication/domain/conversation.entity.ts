// modules/communication/domain/conversation.entity.ts · the conversations aggregate (order/dispute/direct chat).
// A thin context holder + lock flag; participants live in conversation_participants (managed by the service).
// No version column → the repo locks FOR UPDATE when toggling is_locked. Soft-deletable (deleted_at).
import { ContextType, DomainEvent, MessagingEventType } from './messaging.events';
import { InvalidConversationError } from './messaging.errors';

export interface ConversationProps {
  id: string; tenantId: string; contextType: ContextType; contextId: string | null; isLocked: boolean; createdAt?: Date;
}
export class Conversation {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: ConversationProps) {}

  static open(input: Omit<ConversationProps, 'isLocked'>): Conversation {
    if (input.contextType !== 'direct' && !input.contextId) throw new InvalidConversationError('contextId required for a context-linked conversation');
    const c = new Conversation({ ...input, isLocked: false });
    c.events.push({ type: MessagingEventType.ConversationOpened, payload: { conversationId: c.props.id, contextType: c.props.contextType, contextId: c.props.contextId } });
    return c;
  }
  static rehydrate(p: ConversationProps): Conversation { return new Conversation(p); }
  get id() { return this.props.id; }
  get tenantId() { return this.props.tenantId; }
  get isLocked() { return this.props.isLocked; }
  get contextType() { return this.props.contextType; }
  toProps(): Readonly<ConversationProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  lock(): void { if (this.props.isLocked) return; this.props.isLocked = true; this.events.push({ type: MessagingEventType.ConversationLocked, payload: { conversationId: this.props.id, locked: true } }); }
  unlock(): void { if (!this.props.isLocked) return; this.props.isLocked = false; this.events.push({ type: MessagingEventType.ConversationLocked, payload: { conversationId: this.props.id, locked: false } }); }
  toJSON() { const v = this.props; return { id: v.id, contextType: v.contextType, contextId: v.contextId, isLocked: v.isLocked, createdAt: v.createdAt }; }
}
