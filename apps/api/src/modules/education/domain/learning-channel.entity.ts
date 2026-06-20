// modules/education/domain/learning-channel.entity.ts · a creator's external content channel (YouTube/etc.).
// Self-registered as 'pending'; a tenant moderator approves/suspends/rejects (the host-authority gate). No
// version → repo locks FOR UPDATE on moderation. external_url is validated (http/https) to avoid junk/SSRF bait.
import { ChannelProvider, ChannelStatus, DomainEvent, CreatorEventType } from './creator.events';
import { assertTransition } from './channel.state';
import { InvalidChannelError } from './creator.errors';

export interface LearningChannelProps {
  id: string; tenantId: string; ownerUserId: string; provider: ChannelProvider; title: string; handle: string | null;
  externalUrl: string; topicId: string | null; description: string | null; status: ChannelStatus;
  reviewNote: string | null; reviewedBy: string | null; reviewedAt: Date | null; createdAt?: Date;
}
const URL_RE = /^https?:\/\/[^\s]{3,500}$/i;   // anchored, bounded — ReDoS-safe

export class LearningChannel {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: LearningChannelProps) {}

  static register(input: Omit<LearningChannelProps, 'status' | 'reviewNote' | 'reviewedBy' | 'reviewedAt'>): LearningChannel {
    if (!input.title) throw new InvalidChannelError('title required');
    if (!URL_RE.test(input.externalUrl)) throw new InvalidChannelError('external_url must be a valid http(s) URL');
    const c = new LearningChannel({ ...input, status: 'pending', reviewNote: null, reviewedBy: null, reviewedAt: null });
    c.events.push({ type: CreatorEventType.ChannelSubmitted, payload: { channelId: c.props.id, ownerUserId: c.props.ownerUserId, provider: c.props.provider } });
    return c;
  }
  static rehydrate(p: LearningChannelProps): LearningChannel { return new LearningChannel(p); }
  get id() { return this.props.id; }
  get tenantId() { return this.props.tenantId; }
  get ownerUserId() { return this.props.ownerUserId; }
  get status() { return this.props.status; }
  toProps(): Readonly<LearningChannelProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  update(patch: { title?: string; handle?: string | null; description?: string | null; topicId?: string | null }): void {
    if (this.props.status === 'rejected') throw new InvalidChannelError('cannot edit a rejected channel');
    if (patch.title !== undefined) { if (!patch.title) throw new InvalidChannelError('title required'); this.props.title = patch.title; }
    if (patch.handle !== undefined) this.props.handle = patch.handle;
    if (patch.description !== undefined) this.props.description = patch.description;
    if (patch.topicId !== undefined) this.props.topicId = patch.topicId;
  }
  approve(moderatorUserId: string): void { this.moderate('approved', moderatorUserId, null, CreatorEventType.ChannelApproved); }
  suspend(moderatorUserId: string, note: string | null): void { this.moderate('suspended', moderatorUserId, note, CreatorEventType.ChannelSuspended); }
  reject(moderatorUserId: string, note: string | null): void { this.moderate('rejected', moderatorUserId, note, CreatorEventType.ChannelRejected); }

  private moderate(to: ChannelStatus, moderatorUserId: string, note: string | null, eventType: string): void {
    const from = this.props.status; assertTransition(from, to);
    this.props.status = to; this.props.reviewedBy = moderatorUserId; this.props.reviewedAt = new Date(); this.props.reviewNote = note;
    this.events.push({ type: eventType, payload: { channelId: this.props.id, ownerUserId: this.props.ownerUserId, from, to } });
  }
  toJSON() {
    const v = this.props;
    return { id: v.id, ownerUserId: v.ownerUserId, provider: v.provider, title: v.title, handle: v.handle, externalUrl: v.externalUrl,
      topicId: v.topicId, description: v.description, status: v.status, reviewNote: v.reviewNote, reviewedAt: v.reviewedAt, createdAt: v.createdAt };
  }
}
