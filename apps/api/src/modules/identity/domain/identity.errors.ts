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
