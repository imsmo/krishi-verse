// modules/catalogue/domain/certificate.state.ts · the ONE place a certificate's status transitions live (Law 5).
// Reuses the platform kyc_status enum (0003: none|pending|verified|rejected|expired); for certificates only the
// four operative states are used. A submitted cert is `pending`; a moderator verifies or rejects it; a verified
// cert lapses to `expired` (by the expiry job) or can be revoked to `rejected`. rejected/expired are terminal.
import { IllegalCertificateTransitionError } from './catalogue.errors';

export const CERTIFICATE_STATUSES = ['pending', 'verified', 'rejected', 'expired'] as const;
export type CertificateStatus = (typeof CERTIFICATE_STATUSES)[number];

const TRANSITIONS: Readonly<Record<CertificateStatus, readonly CertificateStatus[]>> = Object.freeze({
  pending: ['verified', 'rejected'],
  verified: ['expired', 'rejected'],   // expiry job → expired; manual revoke → rejected
  rejected: [],
  expired: [],
});

export function canTransition(from: CertificateStatus, to: CertificateStatus): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}
export function assertTransition(from: CertificateStatus, to: CertificateStatus): void {
  if (!canTransition(from, to)) throw new IllegalCertificateTransitionError(from, to);
}
