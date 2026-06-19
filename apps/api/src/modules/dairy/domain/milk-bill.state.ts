// modules/dairy/domain/milk-bill.state.ts · STATE MACHINE for milk_bills.status (Law 5).
//   draft → previewed → approved → paid   (+ disputed from previewed; resolve back to previewed)
// A cycle job generates the draft; the member can preview + dispute within the window; the cooperative
// approves; payout settles via the wallet → paid (terminal).
import { DomainError } from '../../../shared/errors/app-error';

export const BILL_STATUSES = ['draft', 'previewed', 'disputed', 'approved', 'paid'] as const;
export type BillStatus = (typeof BILL_STATUSES)[number];

const TRANSITIONS: Readonly<Record<BillStatus, readonly BillStatus[]>> = Object.freeze({
  draft:     ['previewed'],
  previewed: ['disputed', 'approved'],
  disputed:  ['previewed', 'approved'],   // resolved → re-previewed, or override-approved
  approved:  ['paid'],
  paid:      [],
});
export class IllegalBillTransitionError extends DomainError {
  constructor(from: string, to: string) { super('BILL_ILLEGAL_TRANSITION', `Cannot move milk bill ${from}→${to}`, 409, { from, to }); }
}
export function canTransition(from: BillStatus, to: BillStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: BillStatus, to: BillStatus): void { if (!canTransition(from, to)) throw new IllegalBillTransitionError(from, to); }
export function isTerminal(s: BillStatus): boolean { return s === 'paid'; }
