// apps/mobile/src/features/labour/decline-job.ts · PURE logic for the worker Decline-Job screen (142). No React /
// no SDK I/O → unit-tested. The decline itself is labour.respondOffer(id, 'reject') in labour.api. The decline
// REASON + free-text MESSAGE have no field on the respondAssignment contract yet, so this file only validates them
// for the UI — they are captured + flagged (not sent) rather than faked into a payload (§13). The reject is real.
export const DECLINE_REASONS = [
  { key: 'booked', icon: '📅' },
  { key: 'wage', icon: '💰' },
  { key: 'far', icon: '📍' },
  { key: 'health', icon: '🤒' },
  { key: 'family', icon: '🏠' },
  { key: 'farmer', icon: '🙅' },
] as const;
export type DeclineReasonKey = (typeof DECLINE_REASONS)[number]['key'];

/** Trim + collapse a free-text decline message, cap length, empty → null. Pure. */
export function normalizeDeclineMessage(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (!s) return null;
  return s.slice(0, 300);
}

/** The "Send Decline" CTA enables once a reason is picked (helps matching). Declining is never penalised; the
 * worker can also just go Back. Pure. */
export function canSendDecline(reason: DeclineReasonKey | null | undefined): boolean {
  return !!reason && DECLINE_REASONS.some((r) => r.key === reason);
}
