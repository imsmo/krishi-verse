// modules/payments/domain/payout.state.ts · the payout_status state machine (Law 5).
// Mirrors the payout_status enum in db/migrations/0006_money.sql.
import { DomainError } from '../../../shared/errors/app-error';

export const PAYOUT_STATUSES = ['queued', 'processing', 'success', 'failed', 'reversed', 'cancelled'] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

// Payout priority lanes (payouts.priority — lower number = disbursed first). Default settlement
// payouts use 100 (see Payout.queue); wages are promoted into a fast lane so a worker's money
// reaches their bank ahead of the bulk settlement queue. Kept small + named so the wage handler
// and the wage-lane worker job agree on the boundary.
export const WAGE_LANE_PRIORITY = 10;
export const DEFAULT_PAYOUT_PRIORITY = 100;

const TRANSITIONS: Readonly<Record<PayoutStatus, readonly PayoutStatus[]>> = Object.freeze({
  queued:     ['processing', 'cancelled'],
  processing: ['success', 'failed'],
  failed:     ['queued', 'reversed'],     // retry or give the money back
  success:    ['reversed'],               // clawback (rare)
  reversed:   [],
  cancelled:  [],
});

export class IllegalPayoutTransitionError extends DomainError {
  constructor(from: string, to: string) { super('PAYOUT_ILLEGAL_TRANSITION', `Cannot move payout ${from}→${to}`, 409, { from, to }); }
}
export function canTransition(from: PayoutStatus, to: PayoutStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: PayoutStatus, to: PayoutStatus): void { if (!canTransition(from, to)) throw new IllegalPayoutTransitionError(from, to); }
export function isTerminal(s: PayoutStatus): boolean { return s === 'reversed' || s === 'cancelled'; }
