// modules/schemes/domain/schemes.errors.ts · typed errors with stable codes (mapped to HTTP/i18n).
import { AppError, DomainError, NotFoundError } from '../../../shared/errors/app-error';

export class SchemeAuthorityNotFoundError extends NotFoundError { constructor(id: string) { super('Scheme authority not found'); (this as any).code = 'SCHEME_AUTHORITY_NOT_FOUND'; (this as any).details = { id }; } }
export class SchemeNotFoundError extends NotFoundError { constructor(id: string) { super('Scheme not found'); (this as any).code = 'SCHEME_NOT_FOUND'; (this as any).details = { id }; } }
export class ApplicationNotFoundError extends NotFoundError { constructor(id: string) { super('Scheme application not found'); (this as any).code = 'SCHEME_APPLICATION_NOT_FOUND'; (this as any).details = { id }; } }

export class SchemeInactiveError extends DomainError { constructor(code: string) { super('SCHEME_INACTIVE', `Scheme '${code}' is not currently active`, 409, { code }); } }
export class InvalidApplicationError extends DomainError { constructor(message: string) { super('SCHEME_APPLICATION_INVALID', message, 422); } }
export class InvalidDbtError extends DomainError { constructor(message: string) { super('DBT_TRANSFER_INVALID', message, 422); } }
export class SchemesForbiddenError extends AppError { constructor(message = 'Not allowed on this scheme resource') { super('SCHEMES_FORBIDDEN', message, 403); } }
