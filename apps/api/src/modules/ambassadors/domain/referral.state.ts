// modules/ambassadors/domain/referral.state.ts · STATE MACHINE for referrals.status (Law 5).
//   invited → signed_up → activated → rewarded   (forward-only; reward is the terminal, money-bearing step).
import { DomainError } from '../../../shared/errors/app-error';
import { ReferralStatus } from './ambassadors.events';

const TRANSITIONS: Readonly<Record<ReferralStatus, readonly ReferralStatus[]>> = Object.freeze({
  invited:   ['signed_up'],
  signed_up: ['activated'],
  activated: ['rewarded'],
  rewarded:  [],
});
export class IllegalReferralTransitionError extends DomainError {
  constructor(from: string, to: string) { super('REFERRAL_ILLEGAL_TRANSITION', `Cannot move referral ${from}→${to}`, 409, { from, to }); }
}
export function canTransition(from: ReferralStatus, to: ReferralStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: ReferralStatus, to: ReferralStatus): void { if (!canTransition(from, to)) throw new IllegalReferralTransitionError(from, to); }
