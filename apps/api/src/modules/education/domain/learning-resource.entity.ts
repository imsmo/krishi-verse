// modules/education/domain/learning-resource.entity.ts · a curated external item (video/blog/post/audio/article).
// Under an APPROVED channel it is born 'approved' (the channel established trust); standalone it is 'pending'
// until a moderator approves. A moderator can take it down (→ rejected) or the owner can archive it.
import { ResourceKind, ResourceStatus, DomainEvent, CreatorEventType } from './creator.events';
import { InvalidResourceError } from './creator.errors';

export interface LearningResourceProps {
  id: string; tenantId: string; channelId: string | null; ownerUserId: string; kind: ResourceKind; title: string;
  externalUrl: string | null; mediaId: string | null; topicId: string | null; languageCode: string | null; body: string | null;
  status: ResourceStatus; reviewedBy: string | null; reviewedAt: Date | null; createdAt?: Date;
}
const URL_RE = /^https?:\/\/[^\s]{3,500}$/i;

export class LearningResource {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: LearningResourceProps) {}

  static create(input: Omit<LearningResourceProps, 'status' | 'reviewedBy' | 'reviewedAt'> & { autoApprove: boolean }): LearningResource {
    if (!input.title) throw new InvalidResourceError('title required');
    if (!input.externalUrl && !input.mediaId) throw new InvalidResourceError('a resource needs an external_url or a media file');
    if (input.externalUrl && !URL_RE.test(input.externalUrl)) throw new InvalidResourceError('external_url must be a valid http(s) URL');
    const { autoApprove, ...rest } = input;
    const status: ResourceStatus = autoApprove ? 'approved' : 'pending';
    const r = new LearningResource({ ...rest, status, reviewedBy: null, reviewedAt: null });
    if (status === 'approved') r.events.push({ type: CreatorEventType.ResourcePublished, payload: { resourceId: r.props.id, channelId: r.props.channelId, kind: r.props.kind } });
    return r;
  }
  static rehydrate(p: LearningResourceProps): LearningResource { return new LearningResource(p); }
  get id() { return this.props.id; }
  get ownerUserId() { return this.props.ownerUserId; }
  get status() { return this.props.status; }
  toProps(): Readonly<LearningResourceProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  approve(moderatorUserId: string): void {
    if (this.props.status !== 'pending') throw new InvalidResourceError(`cannot approve a ${this.props.status} resource`);
    this.props.status = 'approved'; this.props.reviewedBy = moderatorUserId; this.props.reviewedAt = new Date();
    this.events.push({ type: CreatorEventType.ResourcePublished, payload: { resourceId: this.props.id, channelId: this.props.channelId, kind: this.props.kind } });
  }
  takedown(moderatorUserId: string, note: string | null): void {
    if (this.props.status === 'rejected') return;
    this.props.status = 'rejected'; this.props.reviewedBy = moderatorUserId; this.props.reviewedAt = new Date();
    this.events.push({ type: CreatorEventType.ResourceTakenDown, payload: { resourceId: this.props.id, note } });
  }
  archive(): void { if (this.props.status !== 'rejected') this.props.status = 'archived'; }
  toJSON() {
    const v = this.props;
    return { id: v.id, channelId: v.channelId, ownerUserId: v.ownerUserId, kind: v.kind, title: v.title, externalUrl: v.externalUrl,
      mediaId: v.mediaId, topicId: v.topicId, languageCode: v.languageCode, body: v.body, status: v.status, createdAt: v.createdAt };
  }
}
