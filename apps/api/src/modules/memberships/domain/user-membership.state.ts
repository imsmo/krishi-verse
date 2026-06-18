// modules/memberships/domain/user-membership.state.ts · the user_memberships.status state machine (Law 5).
// Mirrors the documented values in db/migrations/0015_audit_additions.sql (user_memberships.status):
//   active | past_due | cancelled | expired
import { DomainError } from '../../../shared/errors/app-error';

export const MEMBERSHIP_STATUSES = ['active', 'past_due', 'cancelled', 'expired'] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

const TRANSITIONS: Readonly<Record<MembershipStatus, readonly MembershipStatus[]>> = Object.freeze({
  active:    ['past_due', 'cancelled', 'expired'],
  past_due:  ['active', 'cancelled', 'expired'],   // renewed (active) or lapses
  cancelled: [],
  expired:   [],
});

export class IllegalMembershipTransitionError extends DomainError {
  constructor(from: string, to: string) { super('MEMBERSHIP_ILLEGAL_TRANSITION', `Cannot move membership ${from}→${to}`, 409, { from, to }); }
}
export function canTransition(from: MembershipStatus, to: MembershipStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: MembershipStatus, to: MembershipStatus): void { if (!canTransition(from, to)) throw new IllegalMembershipTransitionError(from, to); }
/** Whether the member currently enjoys the tier's benefits (active, or in the grace window). */
export function hasBenefits(s: MembershipStatus): boolean { return s === 'active' || s === 'past_due'; }
export function isLive(s: MembershipStatus): boolean { return s === 'active' || s === 'past_due'; }
