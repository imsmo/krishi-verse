// core/bulk/domain/bulk-import.state.ts · the bulk_import_jobs.status state machine (Law 5 — the ONLY place
// import-job transitions are decided). Mirrors the CHECK in db/migrations/0030:
//   pending → processing → completed | partially_completed | failed
//   pending → cancelled (cancel before it starts); processing → cancelled (operator abort)
import { DomainError } from '../../../shared/errors/app-error';
import { BulkStatus } from './bulk-import.events';

const TRANSITIONS: Readonly<Record<BulkStatus, readonly BulkStatus[]>> = Object.freeze({
  pending:             ['processing', 'cancelled'],
  processing:          ['completed', 'partially_completed', 'failed', 'cancelled'],
  completed:           [],
  partially_completed: [],
  failed:              [],
  cancelled:           [],
});

export class IllegalBulkTransitionError extends DomainError {
  constructor(from: string, to: string) { super('BULK_ILLEGAL_TRANSITION', `Cannot move import job ${from}→${to}`, 409, { from, to }); }
}
export function canTransition(from: BulkStatus, to: BulkStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: BulkStatus, to: BulkStatus): void { if (!canTransition(from, to)) throw new IllegalBulkTransitionError(from, to); }
export function isActive(s: BulkStatus): boolean { return s === 'pending' || s === 'processing'; }
export function isTerminal(s: BulkStatus): boolean { return !isActive(s); }
/** Final status from the row tallies (all-fail or fatal handled by the caller before this). */
export function terminalFor(succeeded: number, failed: number): BulkStatus {
  if (failed === 0) return 'completed';
  if (succeeded === 0) return 'failed';
  return 'partially_completed';
}
