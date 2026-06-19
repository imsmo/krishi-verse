// modules/contract-farming/domain/farming-contract.state.ts · STATE MACHINE for farming_contracts.status (Law 5).
// Subset of the contract_status enum used by this build:
//   draft → proposed → signed → active → fulfilled   (+ terminate from proposed|signed|active)
// 'negotiating' / 'breached' / 'disputed' are reserved for the deferred negotiation + dispute wiring.
import { DomainError } from '../../../shared/errors/app-error';

export const CONTRACT_STATUSES = ['draft','proposed','signed','active','fulfilled','terminated'] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

const TRANSITIONS: Readonly<Record<ContractStatus, readonly ContractStatus[]>> = Object.freeze({
  draft:      ['proposed', 'terminated'],
  proposed:   ['signed', 'terminated'],
  signed:     ['active', 'terminated'],
  active:     ['fulfilled', 'terminated'],
  fulfilled:  [],
  terminated: [],
});
export class IllegalContractTransitionError extends DomainError {
  constructor(from: string, to: string) { super('CONTRACT_ILLEGAL_TRANSITION', `Cannot move contract ${from}→${to}`, 409, { from, to }); }
}
export function canTransition(from: ContractStatus, to: ContractStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: ContractStatus, to: ContractStatus): void { if (!canTransition(from, to)) throw new IllegalContractTransitionError(from, to); }
export function isActive(s: ContractStatus): boolean { return s === 'active'; }
/** Growers may be enrolled while the contract is still being set up (not yet active is fine, up to signed). */
export function acceptsEnrolment(s: ContractStatus): boolean { return s === 'draft' || s === 'proposed' || s === 'signed' || s === 'active'; }
