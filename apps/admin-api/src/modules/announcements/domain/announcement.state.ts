// apps/admin-api/src/modules/announcements/domain/announcement.state.ts · the announcement lifecycle state machine
// (Law 5 — the ONLY place transitions are decided). Mirrors the CHECK in db/migrations/0040:
//   draft → scheduled (set a future window) | published (go live now) | archived (discard)
//   scheduled → published (window reached / manual) | archived
//   published → expired (window ended / manual) | archived
//   expired → archived ; archived is terminal.
export const ANNOUNCEMENT_STATUSES = ['draft', 'scheduled', 'published', 'expired', 'archived'] as const;
export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUSES)[number];

import { IllegalAnnouncementTransitionError } from './announcements.errors';

const TRANSITIONS: Readonly<Record<AnnouncementStatus, readonly AnnouncementStatus[]>> = Object.freeze({
  draft:     ['scheduled', 'published', 'archived'],
  scheduled: ['published', 'archived'],
  published: ['expired', 'archived'],
  expired:   ['archived'],
  archived:  [],
});

export function canTransition(from: AnnouncementStatus, to: AnnouncementStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}
export function assertTransition(from: AnnouncementStatus, to: AnnouncementStatus): void {
  if (!canTransition(from, to)) throw new IllegalAnnouncementTransitionError(from, to);
}
/** Content/schedule may only be edited while still being prepared. */
export function isEditable(s: AnnouncementStatus): boolean { return s === 'draft' || s === 'scheduled'; }
