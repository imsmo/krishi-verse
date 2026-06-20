// modules/cms/domain/cms.events.ts · integration events (via outbox) + vocab.
export const CmsEventType = {
  PagePublished: 'cms.page_published',
  PageArchived:  'cms.page_archived',
  BannerCreated: 'cms.banner_created',
} as const;
export type CmsEventType = (typeof CmsEventType)[keyof typeof CmsEventType];
export type DomainEvent = { type: string; payload: Record<string, unknown> };

export const PAGE_KINDS = ['static', 'policy', 'faq', 'help_article'] as const;
export type PageKind = (typeof PAGE_KINDS)[number];
export const PAGE_STATUSES = ['draft', 'published', 'archived'] as const;
export type PageStatus = (typeof PAGE_STATUSES)[number];
