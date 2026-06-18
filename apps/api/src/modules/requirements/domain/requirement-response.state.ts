// modules/requirements/domain/requirement-response.state.ts · the requirement_responses.status machine
// (Law 5). Mirrors the documented values in db/migrations/0005_commerce.sql (varchar, not an enum):
//   submitted | shortlisted | accepted | rejected | expired
import { DomainError } from '../../../shared/errors/app-error';

export const RESPONSE_STATUSES = ['submitted', 'shortlisted', 'accepted', 'rejected', 'expired'] as const;
export type ResponseStatus = (typeof RESPONSE_STATUSES)[number];

const TRANSITIONS: Readonly<Record<ResponseStatus, readonly ResponseStatus[]>> = Object.freeze({
  submitted:   ['shortlisted', 'accepted', 'rejected', 'expired'],
  shortlisted: ['accepted', 'rejected', 'expired'],
  accepted:    [],     // a deal — the order is created downstream (orders)
  rejected:    [],
  expired:     [],
});

export class IllegalResponseTransitionError extends DomainError {
  constructor(from: string, to: string) { super('RESPONSE_ILLEGAL_TRANSITION', `Cannot move response ${from}→${to}`, 409, { from, to }); }
}
export function canTransition(from: ResponseStatus, to: ResponseStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: ResponseStatus, to: ResponseStatus): void { if (!canTransition(from, to)) throw new IllegalResponseTransitionError(from, to); }
export function isLive(s: ResponseStatus): boolean { return s === 'submitted' || s === 'shortlisted'; }
