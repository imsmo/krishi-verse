// modules/payments/domain/mandate.state.ts · the upi_mandate status state machine (Law 5). The ONLY
// place transitions live. Mirrors the status CHECK in db/migrations/0049_upi_mandates.sql.
import { DomainError } from '../../../shared/errors/app-error';

export const MANDATE_STATUSES = ['pending', 'active', 'paused', 'cancelled', 'expired'] as const;
export type MandateStatus = (typeof MANDATE_STATUSES)[number];

const TRANSITIONS: Readonly<Record<MandateStatus, readonly MandateStatus[]>> = Object.freeze({
  pending:   ['active', 'cancelled', 'expired'],   // PSP confirms → active; user/abort → cancelled; setup window lapses → expired
  active:    ['paused', 'cancelled', 'expired'],
  paused:    ['active', 'cancelled', 'expired'],
  cancelled: [],                                    // terminal
  expired:   [],                                    // terminal
});

export class IllegalMandateTransitionError extends DomainError {
  constructor(from: string, to: string) { super('MANDATE_ILLEGAL_TRANSITION', `Cannot move mandate ${from}→${to}`, 409, { from, to }); }
}
export function canTransition(from: MandateStatus, to: MandateStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: MandateStatus, to: MandateStatus): void { if (!canTransition(from, to)) throw new IllegalMandateTransitionError(from, to); }
export function isTerminal(s: MandateStatus): boolean { return s === 'cancelled' || s === 'expired'; }
export function isLive(s: MandateStatus): boolean { return s === 'pending' || s === 'active' || s === 'paused'; }
