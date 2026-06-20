// modules/services-marketplace/domain/service-offering.state.ts · STATE MACHINE for service_offerings.status (Law 5).
//   draft → published → paused → published … ; any non-archived → archived (terminal)
import { DomainError } from '../../../shared/errors/app-error';
import { OfferingStatus } from './services-marketplace.events';

const TRANSITIONS: Readonly<Record<OfferingStatus, readonly OfferingStatus[]>> = Object.freeze({
  draft:     ['published', 'archived'],
  published: ['paused', 'archived'],
  paused:    ['published', 'archived'],
  archived:  [],
});
export class IllegalOfferingTransitionError extends DomainError {
  constructor(from: string, to: string) { super('OFFERING_ILLEGAL_TRANSITION', `Cannot move offering ${from}→${to}`, 409, { from, to }); }
}
export function canTransition(from: OfferingStatus, to: OfferingStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: OfferingStatus, to: OfferingStatus): void { if (!canTransition(from, to)) throw new IllegalOfferingTransitionError(from, to); }
export function isBookable(s: OfferingStatus): boolean { return s === 'published'; }
