// apps/mobile/src/features/orders/dispute.ts · PURE logic for the buyer "Report order issue" form (screen 135). No
// React/native deps → unit-tested. The dispute contract carries only a FREE-TEXT note (orders.dispute), so the
// chosen reason + desired resolution are composed INTO that note here (real, sent to the server) rather than
// pretending there are structured fields the API doesn't have (§13).
export const DISPUTE_REASONS = ['quality', 'quantity', 'damaged', 'late', 'wrong', 'other'] as const;
export type DisputeReason = (typeof DISPUTE_REASONS)[number];
export const DISPUTE_RESOLUTIONS = ['partial', 'return', 'replacement'] as const;
export type DisputeResolution = (typeof DISPUTE_RESOLUTIONS)[number];

const MAX_NOTE = 2000;

/** Join the labelled segments (reason line, resolution line, free description) into one note, dropping empties and
 * bounding length so a hostile paste can't blow the payload (the server also re-validates). Pure. */
export function composeDisputeNote(segments: Array<string | null | undefined>): string {
  return segments.map((s) => (s ?? '').trim()).filter(Boolean).join('\n\n').slice(0, MAX_NOTE);
}

/** Can the dispute be submitted? A reason must be chosen and the description must be meaningful (≥ 5 chars). The
 * server re-validates + authorizes ownership/state. Pure. */
export function canSubmitDispute(reason: DisputeReason | null, description: string): boolean {
  return reason !== null && description.trim().length >= 5;
}
