// modules/warehousing/domain/nwr-receipt.state.ts · STATE MACHINE for nwr_receipts.status (nwr_status, Law 5).
//   issued → released | cancelled   (pledged / partially_released / defaulted = the fintech loan-collateral
//   flow, DEFERRED — those transitions are intentionally not reachable in this build).
import { DomainError } from '../../../shared/errors/app-error';

export const NWR_STATUSES = ['issued', 'pledged', 'partially_released', 'released', 'cancelled', 'defaulted'] as const;
export type NwrStatus = (typeof NWR_STATUSES)[number];

const TRANSITIONS: Readonly<Record<NwrStatus, readonly NwrStatus[]>> = Object.freeze({
  issued:             ['released', 'cancelled'],
  pledged:            [],   // deferred (loan collateral)
  partially_released: [],   // deferred
  released:           [],
  cancelled:          [],
  defaulted:          [],
});
export class IllegalNwrTransitionError extends DomainError {
  constructor(from: string, to: string) { super('NWR_ILLEGAL_TRANSITION', `Cannot move NWR ${from}→${to}`, 409, { from, to }); }
}
export function canTransition(from: NwrStatus, to: NwrStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: NwrStatus, to: NwrStatus): void { if (!canTransition(from, to)) throw new IllegalNwrTransitionError(from, to); }
export function isActive(s: NwrStatus): boolean { return s === 'issued' || s === 'pledged' || s === 'partially_released'; }
