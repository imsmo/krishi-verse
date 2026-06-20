// modules/education/domain/creator.events.ts · integration events (via outbox) for the creator-content layer.
export const CreatorEventType = {
  ChannelSubmitted: 'education.channel_submitted',
  ChannelApproved:  'education.channel_approved',
  ChannelSuspended: 'education.channel_suspended',
  ChannelRejected:  'education.channel_rejected',
  ResourcePublished:'education.resource_published',
  ResourceTakenDown:'education.resource_taken_down',
  LiveScheduled:    'education.live_scheduled',
  LiveStarted:      'education.live_started',
  LiveEnded:        'education.live_ended',
  LiveCancelled:    'education.live_cancelled',
} as const;
export type CreatorEventType = (typeof CreatorEventType)[keyof typeof CreatorEventType];
export type DomainEvent = { type: string; payload: Record<string, unknown> };

export const CHANNEL_PROVIDERS = ['youtube', 'vimeo', 'website', 'podcast', 'other'] as const;
export type ChannelProvider = (typeof CHANNEL_PROVIDERS)[number];
export const CHANNEL_STATUSES = ['pending', 'approved', 'suspended', 'rejected'] as const;
export type ChannelStatus = (typeof CHANNEL_STATUSES)[number];
export const RESOURCE_KINDS = ['video', 'blog', 'post', 'audio', 'article'] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];
export const RESOURCE_STATUSES = ['pending', 'approved', 'rejected', 'archived'] as const;
export type ResourceStatus = (typeof RESOURCE_STATUSES)[number];
export const LIVE_STATUSES = ['scheduled', 'live', 'ended', 'cancelled'] as const;
export type LiveStatus = (typeof LIVE_STATUSES)[number];
