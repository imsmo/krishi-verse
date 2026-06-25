// modules/identity/domain/identity.errors.ts · typed domain errors with stable codes.
import { DomainError } from '../../../shared/errors/app-error';

export class UserNotFoundError extends DomainError {
  constructor(ref: string) { super('USER_NOT_FOUND', `User ${ref} not found`, 404); }
}
export class InvalidPhoneError extends DomainError {
  constructor() { super('INVALID_PHONE', 'Phone number is not a valid E.164 number', 422); }
}
export class UserNotActiveError extends DomainError {
  constructor(status: string) { super('USER_NOT_ACTIVE', `User is ${status}`, 403, { status }); }
}
export class IllegalUserTransitionError extends DomainError {
  constructor(from: string, to: string) { super('USER_ILLEGAL_TRANSITION', `Cannot move user ${from}→${to}`, 409, { from, to }); }
}
export class InvalidOtpError extends DomainError {
  constructor() { super('OTP_INVALID', 'Invalid or expired verification code', 401); }
}
export class PhoneAlreadyInUseError extends DomainError {
  constructor() { super('PHONE_IN_USE', 'That phone number is already registered to another account', 409); }
}
export class InvalidRefreshError extends DomainError {
  constructor() { super('REFRESH_INVALID', 'Refresh token is invalid, expired, or revoked', 401); }
}
export class RoleNotFoundError extends DomainError {
  constructor(ref: string) { super('ROLE_NOT_FOUND', `Role ${ref} not found`, 404); }
}
export class RoleAlreadyAssignedError extends DomainError {
  constructor() { super('ROLE_ALREADY_ASSIGNED', 'User already holds this role in this tenant', 409); }
}
export class RoleNotApprovedError extends DomainError {
  constructor() { super('ROLE_NOT_APPROVED', 'Role assignment requires approval before activation', 409); }
}
export class KycNotFoundError extends DomainError {
  constructor(id: string) { super('KYC_NOT_FOUND', `KYC document ${id} not found`, 404); }
}
export class IllegalKycTransitionError extends DomainError {
  constructor(from: string, to: string) { super('KYC_ILLEGAL_TRANSITION', `Cannot move KYC ${from}→${to}`, 409, { from, to }); }
}
export class ConcurrencyError extends DomainError {
  constructor(entity: string, id: string) { super('CONCURRENCY_CONFLICT', `${entity} ${id} was modified concurrently; retry`, 409); }
}
export class UnderageError extends DomainError {
  constructor(minAge: number) { super('UNDERAGE', `Must be at least ${minAge} years old for this role`, 422, { minAge }); }
}

// --- eKYC (P0-11) ---
/** The submitted Aadhaar/PAN failed format/checksum validation — rejected BEFORE any provider call (anti-abuse). */
export class InvalidGovIdError extends DomainError {
  constructor(docType: string) { super('EKYC_INVALID_ID', `The supplied ${docType} is not a valid number`, 422, { docType }); }
}
/** The external eKYC provider was unreachable / errored after resilience exhausted — degrade, surface 503. */
export class EkycProviderError extends DomainError {
  constructor(reason = 'eKYC provider unavailable') { super('EKYC_PROVIDER_UNAVAILABLE', reason, 503); }
}
/** No live eKYC session for this id (wrong id / not the caller's / already terminal) — 404 (no enumeration). */
export class EkycSessionNotFoundError extends DomainError {
  constructor(id: string) { super('EKYC_SESSION_NOT_FOUND', `eKYC session ${id} not found`, 404, { id }); }
}
/** OTP verification failed (wrong/expired) — the session counts the attempt and may lock. Never echoes the id. */
export class EkycVerificationFailedError extends DomainError {
  constructor(reason = 'verification failed') { super('EKYC_VERIFICATION_FAILED', reason, 422, { reason }); }
}
/** Too many failed OTP attempts — the session is locked (abuse cap). */
export class EkycTooManyAttemptsError extends DomainError {
  constructor() { super('EKYC_TOO_MANY_ATTEMPTS', 'Too many failed attempts; start a new verification', 429); }
}
export class IllegalEkycTransitionError extends DomainError {
  constructor(from: string, to: string) { super('EKYC_ILLEGAL_TRANSITION', `Cannot move eKYC session ${from}→${to}`, 409, { from, to }); }
}
