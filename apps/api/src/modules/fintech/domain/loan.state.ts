// modules/fintech/domain/loan.state.ts · STATE MACHINE for loans.status (Law 5).
//   active → overdue → active (cured) ; active|overdue → closed (fully repaid) | written_off
// 'restructured' / 'transferred' are reserved for the deferred servicing flows.
import { DomainError } from '../../../shared/errors/app-error';

export const LOAN_STATUSES = ['active','overdue','closed','written_off'] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];

const TRANSITIONS: Readonly<Record<LoanStatus, readonly LoanStatus[]>> = Object.freeze({
  active:      ['overdue', 'closed', 'written_off'],
  overdue:     ['active', 'closed', 'written_off'],
  closed:      [],
  written_off: [],
});
export class IllegalLoanTransitionError extends DomainError {
  constructor(from: string, to: string) { super('LOAN_ILLEGAL_TRANSITION', `Cannot move loan ${from}→${to}`, 409, { from, to }); }
}
export function canTransition(from: LoanStatus, to: LoanStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: LoanStatus, to: LoanStatus): void { if (!canTransition(from, to)) throw new IllegalLoanTransitionError(from, to); }
export function isServicing(s: LoanStatus): boolean { return s === 'active' || s === 'overdue'; }
