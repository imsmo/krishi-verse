// modules/schemes/domain/scheme-application.state.ts · STATE MACHINE for scheme_applications.status (Law 5).
// Mirrors the application_status enum (db/migrations/0011):
//   draft → submitted → under_verification → (clarification_needed ↔ under_verification) → approved → disbursed → closed
//   under_verification → rejected ; rejected → appealed → under_verification
import { DomainError } from '../../../shared/errors/app-error';

export const APPLICATION_STATUSES = ['draft','submitted','under_verification','clarification_needed','approved','rejected','disbursed','closed','appealed'] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

const TRANSITIONS: Readonly<Record<ApplicationStatus, readonly ApplicationStatus[]>> = Object.freeze({
  draft:                ['submitted'],
  submitted:            ['under_verification'],
  under_verification:   ['clarification_needed', 'approved', 'rejected'],
  clarification_needed: ['under_verification'],
  approved:             ['disbursed'],
  rejected:             ['appealed'],
  disbursed:            ['closed'],
  appealed:             ['under_verification'],
  closed:               [],
});
export class IllegalApplicationTransitionError extends DomainError {
  constructor(from: string, to: string) { super('SCHEME_APP_ILLEGAL_TRANSITION', `Cannot move scheme application ${from}→${to}`, 409, { from, to }); }
}
export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: ApplicationStatus, to: ApplicationStatus): void { if (!canTransition(from, to)) throw new IllegalApplicationTransitionError(from, to); }
export function isTerminal(s: ApplicationStatus): boolean { return s === 'closed'; }
