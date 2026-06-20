// modules/cms/domain/cms-page.entity.ts · the cms_pages aggregate (one row = one VERSION of a slug).
// A page is created as a draft (version N for its slug); editing is allowed only while draft; publishing stamps
// published_at; a published page is re-edited by minting a NEW version (a fresh draft) — the live row is never
// mutated. Platform pages have tenant_id NULL. No optimistic-lock column → repo locks FOR UPDATE.
import { PageKind, PageStatus, DomainEvent, CmsEventType } from './cms.events';
import { assertTransition } from './cms-page.state';
import { InvalidPageError } from './cms.errors';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;   // anchored kebab-case, ReDoS-safe

export interface CmsPageProps {
  id: string; tenantId: string | null; slug: string; pageKind: PageKind; defaultTitle: string; body: string;
  version: number; status: PageStatus; publishedAt: Date | null; createdAt?: Date;
}
export class CmsPage {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: CmsPageProps) {}

  static create(input: Omit<CmsPageProps, 'status' | 'publishedAt'>): CmsPage {
    if (!SLUG_RE.test(input.slug)) throw new InvalidPageError('slug must be kebab-case (a-z0-9, hyphens)');
    if (!input.defaultTitle) throw new InvalidPageError('title required');
    if (!input.body) throw new InvalidPageError('body required');
    if (input.version < 1) throw new InvalidPageError('version starts at 1');
    return new CmsPage({ ...input, status: 'draft', publishedAt: null });
  }
  static rehydrate(p: CmsPageProps): CmsPage { return new CmsPage(p); }
  get id() { return this.props.id; }
  get tenantId() { return this.props.tenantId; }
  get slug() { return this.props.slug; }
  get version() { return this.props.version; }
  get status() { return this.props.status; }
  toProps(): Readonly<CmsPageProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  edit(patch: { defaultTitle?: string; body?: string; pageKind?: PageKind }): void {
    if (this.props.status !== 'draft') throw new InvalidPageError('only a draft version can be edited; publish creates a new version');
    if (patch.defaultTitle !== undefined) { if (!patch.defaultTitle) throw new InvalidPageError('title required'); this.props.defaultTitle = patch.defaultTitle; }
    if (patch.body !== undefined) { if (!patch.body) throw new InvalidPageError('body required'); this.props.body = patch.body; }
    if (patch.pageKind !== undefined) this.props.pageKind = patch.pageKind;
  }
  publish(): void {
    assertTransition(this.props.status, 'published');
    this.props.status = 'published'; this.props.publishedAt = new Date();
    this.events.push({ type: CmsEventType.PagePublished, payload: { pageId: this.props.id, slug: this.props.slug, version: this.props.version } });
  }
  archive(): void {
    assertTransition(this.props.status, 'archived');
    this.props.status = 'archived';
    this.events.push({ type: CmsEventType.PageArchived, payload: { pageId: this.props.id, slug: this.props.slug, version: this.props.version } });
  }
  toJSON() {
    const v = this.props;
    return { id: v.id, slug: v.slug, pageKind: v.pageKind, defaultTitle: v.defaultTitle, body: v.body, version: v.version, status: v.status, publishedAt: v.publishedAt, createdAt: v.createdAt };
  }
}
