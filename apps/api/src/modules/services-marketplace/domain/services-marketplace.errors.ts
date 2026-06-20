// modules/services-marketplace/domain/services-marketplace.errors.ts · typed errors with stable codes.
import { AppError, DomainError, NotFoundError } from '../../../shared/errors/app-error';

export class OfferingNotFoundError extends NotFoundError { constructor(id: string) { super('Service offering not found'); (this as any).code = 'OFFERING_NOT_FOUND'; (this as any).details = { id }; } }
export class BookingNotFoundError extends NotFoundError { constructor(id: string) { super('Service booking not found'); (this as any).code = 'SERVICE_BOOKING_NOT_FOUND'; (this as any).details = { id }; } }

export class InvalidOfferingError extends DomainError { constructor(message: string) { super('OFFERING_INVALID', message, 422); } }
export class OfferingNotBookableError extends DomainError { constructor(status: string) { super('OFFERING_NOT_BOOKABLE', `Offering is not published (status: ${status})`, 409, { status }); } }
export class InvalidBookingError extends DomainError { constructor(message: string) { super('SERVICE_BOOKING_INVALID', message, 422); } }
export class BookingNotCompletableError extends DomainError { constructor(status: string) { super('SERVICE_BOOKING_NOT_COMPLETABLE', `Booking cannot be completed from status '${status}'`, 409, { status }); } }
export class ServicesForbiddenError extends AppError { constructor(message = 'Not allowed on this service resource') { super('SERVICES_FORBIDDEN', message, 403); } }
