// modules/ai-governance/domain/moderation.state.ts · the moderation_reports.status state machine (Law 5).
// Mirrors the status values in db/migrations/0013:  open → actioned | dismissed.  A moderator handles an open
// report by either taking an action (actioned) or dismissing it (dismissed); both are terminal.
import { DomainError } from '../../../shared/errors/app-error';
import { ModerationStatus } from './ai-governance.events';

const TRANSITIONS: Readonly<Record<ModerationStatus, readonly ModerationStatus[]>> = Object.freeze({
  open:      ['actioned', 'dismissed'],
  actioned:  [],
  dismissed: [],
});

export class IllegalModerationTransitionError extends DomainError {
  constructor(from: string, to: string) { super('MODERATION_ILLEGAL_TRANSITION', `Cannot move report ${from}→${to}`, 409, { from, to }); }
}
export function canTransition(from: ModerationStatus, to: ModerationStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: ModerationStatus, to: ModerationStatus): void { if (!canTransition(from, to)) throw new IllegalModerationTransitionError(from, to); }
export function isOpen(s: ModerationStatus): boolean { return s === 'open'; }
