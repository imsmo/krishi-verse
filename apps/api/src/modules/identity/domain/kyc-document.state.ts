// modules/identity/domain/kyc-document.state.ts · kyc_status transitions (Law 5).
import { IllegalKycTransitionError } from './identity.errors';
export const KYC_STATUSES = ['none','pending','verified','rejected','expired'] as const;
export type KycStatus = (typeof KYC_STATUSES)[number];

const TRANSITIONS: Readonly<Record<KycStatus, readonly KycStatus[]>> = Object.freeze({
  none:     ['pending'],
  pending:  ['verified', 'rejected'],
  verified: ['expired', 'rejected'],
  rejected: ['pending'],
  expired:  ['pending'],
});
export function canKycTransition(from: KycStatus, to: KycStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}
export function assertKycTransition(from: KycStatus, to: KycStatus): void {
  if (!canKycTransition(from, to)) throw new IllegalKycTransitionError(from, to);
}
