// modules/exports/domain/export-document.state.ts · STATE MACHINE for export_documents.status (Law 5).
//   pending → submitted → verified | rejected   (rejected → submitted on resubmission)
import { DomainError } from '../../../shared/errors/app-error';

export const DOCUMENT_STATUSES = ['pending', 'submitted', 'verified', 'rejected'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

const TRANSITIONS: Readonly<Record<DocumentStatus, readonly DocumentStatus[]>> = Object.freeze({
  pending:   ['submitted'],
  submitted: ['verified', 'rejected'],
  verified:  [],
  rejected:  ['submitted'],
});
export class IllegalDocumentTransitionError extends DomainError {
  constructor(from: string, to: string) { super('EXPORT_DOCUMENT_ILLEGAL_TRANSITION', `Cannot move document ${from}→${to}`, 409, { from, to }); }
}
export function canTransition(from: DocumentStatus, to: DocumentStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: DocumentStatus, to: DocumentStatus): void { if (!canTransition(from, to)) throw new IllegalDocumentTransitionError(from, to); }
export function isCleared(s: DocumentStatus): boolean { return s === 'verified'; }
