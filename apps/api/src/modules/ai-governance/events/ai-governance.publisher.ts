// modules/ai-governance/events/ai-governance.publisher.ts · documents this module's outbox-published events.
// The actual writes happen INSIDE service transactions via OutboxWriter (Law 4) — this is the single reference
// of what ai-governance emits and the payload shape downstream modules can rely on (IDs only, never PII):
//
//   ai.review_enqueued    { reviewId, queueKind, subjectType, subjectId }
//       — a low-confidence/flagged inference (or a manual op item) needs a human; notify AI Ops.
//   ai.review_resolved    { reviewId, decision: 'accepted'|'rejected', queueKind, subjectType, subjectId, reviewerUserId }
//       — the originating module (listings/messaging/…) acts on the human decision.
//   ai.moderation_filed   { reportId, subjectType, subjectId }
//       — the FIRST open report against a subject; notify moderators (deduped — not per duplicate report).
//   ai.moderation_actioned{ reportId, subjectType, subjectId, status, actionTaken, handledBy }
//       — a moderator actioned/dismissed a report; the owning module applies hide/remove/etc.
//   ai.model_promoted / ai.model_retired  { modelId, code, status }
//       — model lifecycle (driven by admin-api; defined here as the shared contract).
export {};
