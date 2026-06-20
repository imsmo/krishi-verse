// modules/ai-governance/domain/ai-governance.events.ts · integration events (via outbox) + shared vocab.
// High-volume note: recording an inference does NOT emit an event (billions of ops — that would be write
// amplification). Events fire only on the consequential transitions: a low-confidence/flagged inference
// ENQUEUES a human review (notify ops), a reviewer RESOLVES it (the originating module acts), a user FILES a
// moderation report (first one on a subject → notify moderators), and a moderator ACTIONS/dismisses it.
export const AiEventType = {
  ReviewEnqueued:     'ai.review_enqueued',
  ReviewResolved:     'ai.review_resolved',
  ModerationFiled:    'ai.moderation_filed',
  ModerationActioned: 'ai.moderation_actioned',
  ModelPromoted:      'ai.model_promoted',
  ModelRetired:       'ai.model_retired',
} as const;
export type AiEventType = (typeof AiEventType)[keyof typeof AiEventType];
export type DomainEvent = { type: string; payload: Record<string, unknown> };

// ai_models.status enum (db/migrations/0013): shadow → canary → production → retired.
export const MODEL_STATUSES = ['shadow', 'canary', 'production', 'retired'] as const;
export type ModelStatus = (typeof MODEL_STATUSES)[number];

// ai_review_queue.status enum (db/migrations/0013): pending → in_review → accepted | rejected.
export const REVIEW_STATUSES = ['pending', 'in_review', 'accepted', 'rejected'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export type ReviewDecision = 'accepted' | 'rejected';

// queue_kind vocabulary (free text in DB; this is the recognised set the platform routes/notifies on).
export const QUEUE_KINDS = ['fraud_flag', 'low_confidence_grade', 'price_anomaly', 'dispute_triage', 'drift', 'manual'] as const;
export type QueueKind = (typeof QUEUE_KINDS)[number];

// moderation_reports.status enum (db/migrations/0013): open → actioned | dismissed.
export const MODERATION_STATUSES = ['open', 'actioned', 'dismissed'] as const;
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

// moderation_reports.action_taken vocabulary.
export const MODERATION_ACTIONS = ['hidden', 'removed', 'warned', 'suspended', 'none'] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];
