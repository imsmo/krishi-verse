// modules/requirements/domain/requirement.state.ts · the requirement_status state machine (Law 5).
// Mirrors the requirement_status ENUM in db/migrations/0005_commerce.sql:
//   open | partially_matched | fulfilled | expired | closed
import { DomainError } from '../../../shared/errors/app-error';

export const REQUIREMENT_STATUSES = ['open', 'partially_matched', 'fulfilled', 'expired', 'closed'] as const;
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

const TRANSITIONS: Readonly<Record<RequirementStatus, readonly RequirementStatus[]>> = Object.freeze({
  open:              ['partially_matched', 'fulfilled', 'expired', 'closed'],
  partially_matched: ['fulfilled', 'expired', 'closed'],
  fulfilled:         [],
  expired:           [],
  closed:            [],
});

export class IllegalRequirementTransitionError extends DomainError {
  constructor(from: string, to: string) { super('REQUIREMENT_ILLEGAL_TRANSITION', `Cannot move requirement ${from}→${to}`, 409, { from, to }); }
}
export function canTransition(from: RequirementStatus, to: RequirementStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: RequirementStatus, to: RequirementStatus): void { if (!canTransition(from, to)) throw new IllegalRequirementTransitionError(from, to); }
/** Sellers may submit quotes only while the requirement is still soliciting. */
export function isAcceptingResponses(s: RequirementStatus): boolean { return s === 'open' || s === 'partially_matched'; }
export function isTerminal(s: RequirementStatus): boolean { return s === 'fulfilled' || s === 'expired' || s === 'closed'; }
