// modules/cms/domain/banner.entity.ts · the banners aggregate (scheduled promotional placement).
// A banner runs in [starts_at, ends_at) at a placement, optionally targeted by audience_rules. is_active is the
// manual on/off; isLive(now) = is_active AND inside the window. click_count is a bounded counter. No status enum.
import { DomainEvent, CmsEventType } from './cms.events';
import { InvalidBannerError } from './cms.errors';

export interface BannerProps {
  id: string; tenantId: string; placement: string; mediaId: string; languageCode: string | null; targetUrl: string | null;
  audienceRules: Record<string, unknown>; startsAt: Date; endsAt: Date; clickCount: number; isActive: boolean; createdAt?: Date;
}
const URL_RE = /^https?:\/\/[^\s]{3,400}$/i;

export class Banner {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: BannerProps) {}

  static create(input: Omit<BannerProps, 'clickCount' | 'isActive'>): Banner {
    if (!input.placement) throw new InvalidBannerError('placement required');
    if (input.endsAt <= input.startsAt) throw new InvalidBannerError('ends_at must be after starts_at');
    if (input.targetUrl && !URL_RE.test(input.targetUrl)) throw new InvalidBannerError('target_url must be a valid http(s) URL');
    const b = new Banner({ ...input, clickCount: 0, isActive: true });
    b.events.push({ type: CmsEventType.BannerCreated, payload: { bannerId: b.props.id, placement: b.props.placement } });
    return b;
  }
  static rehydrate(p: BannerProps): Banner { return new Banner(p); }
  get id() { return this.props.id; }
  get tenantId() { return this.props.tenantId; }
  get isActive() { return this.props.isActive; }
  toProps(): Readonly<BannerProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  isLive(now: Date): boolean { return this.props.isActive && this.props.startsAt <= now && now < this.props.endsAt; }
  activate(): void { this.props.isActive = true; }
  deactivate(): void { this.props.isActive = false; }
  toJSON() {
    const v = this.props;
    return { id: v.id, placement: v.placement, mediaId: v.mediaId, languageCode: v.languageCode, targetUrl: v.targetUrl, audienceRules: v.audienceRules,
      startsAt: v.startsAt, endsAt: v.endsAt, clickCount: v.clickCount, isActive: v.isActive, createdAt: v.createdAt };
  }
}
