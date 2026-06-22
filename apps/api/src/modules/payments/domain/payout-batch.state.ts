// modules/payments/domain/payout-batch.state.ts
// Lifecycle of a payout BATCH (the bookkeeping envelope around a set of disbursements — a daily
// settlement run or a weekly ambassador run). The batch is NOT the money transaction of record (each
// payout's wallet move is its own ACID tx via the wallet boundary); the batch records how many
// payouts were grouped + the settled total, so a run is auditable and reconcilable.
//   open       — created; payouts may still be claimed into it.
//   executing  — disbursement of the claimed payouts is in progress.
//   executed   — the run finished; total_minor + count are final.
//   failed     — the run was abandoned before/while executing (operator/abort); reopened as a NEW batch.
import { DomainError } from '../../../shared/errors/app-error';

export const PAYOUT_BATCH_STATUSES = ['open', 'executing', 'executed', 'failed'] as const;
export type PayoutBatchStatus = (typeof PAYOUT_BATCH_STATUSES)[number];

const TRANSITIONS: Record<PayoutBatchStatus, PayoutBatchStatus[]> = {
  open: ['executing', 'failed'],
  executing: ['executed', 'failed'],
  executed: [],
  failed: [],
};

export class IllegalPayoutBatchTransitionError extends DomainError {
  constructor(from: PayoutBatchStatus, to: PayoutBatchStatus) {
    super('PAYOUT_BATCH_ILLEGAL_TRANSITION', `Cannot move payout batch from ${from} to ${to}`, 409, { from, to });
  }
}

export function canTransition(from: PayoutBatchStatus, to: PayoutBatchStatus): boolean {
  return TRANSITIONS[from].includes(to);
}
export function assertTransition(from: PayoutBatchStatus, to: PayoutBatchStatus): void {
  if (!canTransition(from, to)) throw new IllegalPayoutBatchTransitionError(from, to);
}
export function isTerminal(s: PayoutBatchStatus): boolean { return TRANSITIONS[s].length === 0; }
