// modules/fintech/domain/loan-application.state.ts · STATE MACHINE for loan_applications.status (Law 5).
// Subset of loan_app_status used by this build's origination flow:
//   draft → submitted → under_review → approved → disbursed   (+ rejected from review; withdrawn by applicant)
// 'docs_pending' / 'closed' are reserved for the deferred KYC-docs + closure-sync flows.
import { DomainError } from '../../../shared/errors/app-error';

export const APP_STATUSES = ['draft','submitted','under_review','approved','rejected','withdrawn','disbursed'] as const;
export type AppStatus = (typeof APP_STATUSES)[number];

const TRANSITIONS: Readonly<Record<AppStatus, readonly AppStatus[]>> = Object.freeze({
  draft:        ['submitted', 'withdrawn'],
  submitted:    ['under_review', 'withdrawn'],
  under_review: ['approved', 'rejected'],
  approved:     ['disbursed', 'withdrawn'],   // applicant may still cancel within cooling-off
  rejected:     [],
  withdrawn:    [],
  disbursed:    [],
});
export class IllegalAppTransitionError extends DomainError {
  constructor(from: string, to: string) { super('LOAN_APP_ILLEGAL_TRANSITION', `Cannot move loan application ${from}→${to}`, 409, { from, to }); }
}
export function canTransition(from: AppStatus, to: AppStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: AppStatus, to: AppStatus): void { if (!canTransition(from, to)) throw new IllegalAppTransitionError(from, to); }
export function isTerminal(s: AppStatus): boolean { return s === 'rejected' || s === 'withdrawn' || s === 'disbursed'; }
