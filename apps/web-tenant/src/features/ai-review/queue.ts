// apps/web-tenant/src/features/ai-review/queue.ts · PURE helpers for the AI review-queue console.
// No framework, no I/O → unit-tested. The SERVER is authoritative: it owns the ai_review_queue state machine
// (pending → in_review → accepted|rejected), links the inference under review, and fans the resolution back to
// the originating module via the outbox. These helpers only decide which reviewer actions to OFFER and
// pre-validate the claim/resolve/enqueue forms.

export const REVIEW_STATUSES = ['pending', 'in_review', 'accepted', 'rejected'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export const QUEUE_KINDS = ['fraud_flag', 'low_confidence_grade', 'price_anomaly', 'dispute_triage', 'drift', 'manual'] as const;
export type QueueKind = (typeof QUEUE_KINDS)[number];

export function isOpen(status: string): boolean { return status === 'pending' || status === 'in_review'; }
export function isTerminal(status: string): boolean { return status === 'accepted' || status === 'rejected'; }

/** Which reviewer (ai.review) actions to OFFER next, mirroring ai-review.state (Law 5).
 *  pending → claim + accept + reject (fast triage); in_review → accept + reject; terminal → none. */
export function reviewerActions(status: string): Array<'claim' | 'accept' | 'reject'> {
  switch (status) {
    case 'pending': return ['claim', 'accept', 'reject'];
    case 'in_review': return ['accept', 'reject'];
    default: return [];
  }
}

/** A reviewer may resolve (accept/reject) only an open item. */
export function canResolve(status: string): boolean { return isOpen(status); }

/** Validate the resolve form. decision must be accepted|rejected; note is optional + bounded. */
export function validateResolve(input: { decision?: string; note?: string }): string | null {
  if (input.decision !== 'accepted' && input.decision !== 'rejected') return 'decision';
  if (input.note != null && input.note.length > 1000) return 'note';
  return null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validate the manual-enqueue form. queueKind required; priority 1..1000; subjectId (if given) a UUID. */
export function validateEnqueue(input: { queueKind?: string; priority?: string; subjectType?: string; subjectId?: string }): string | null {
  if (!input.queueKind || !(QUEUE_KINDS as readonly string[]).includes(input.queueKind)) return 'queueKind';
  if (input.priority != null && input.priority !== '') {
    const n = Number(input.priority);
    if (!Number.isInteger(n) || n < 1 || n > 1000) return 'priority';
  }
  if (input.subjectType != null && input.subjectType.length > 50) return 'subjectType';
  if (input.subjectId != null && input.subjectId !== '' && !UUID.test(input.subjectId)) return 'subjectId';
  return null;
}

/** A coarse priority bucket for display (higher number = more urgent). */
export function priorityBucket(priority: number): 'low' | 'normal' | 'high' {
  if (priority >= 500) return 'high';
  if (priority >= 200) return 'normal';
  return 'low';
}

/** Count open (pending + in_review) items — a small queue-health presenter. */
export function openCount(items: Array<{ status: string }>): number {
  return items.reduce((acc, i) => acc + (isOpen(i.status) ? 1 : 0), 0);
}
