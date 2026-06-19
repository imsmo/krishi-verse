// modules/equipment/domain/equipment.errors.ts · typed errors with stable codes (mapped to HTTP/i18n).
import { AppError, DomainError, NotFoundError } from '../../../shared/errors/app-error';

export class AssetNotFoundError extends NotFoundError { constructor(id: string) { super('Equipment asset not found'); (this as any).code = 'ASSET_NOT_FOUND'; (this as any).details = { id }; } }
export class RateNotFoundError extends NotFoundError { constructor(id: string) { super('Equipment rate not found'); (this as any).code = 'RATE_NOT_FOUND'; (this as any).details = { id }; } }
export class NoActiveRateError extends DomainError { constructor(basis: string) { super('NO_ACTIVE_RATE', `No active rate for basis '${basis}' on this asset`, 422, { basis }); } }
export class BookingNotFoundError extends NotFoundError { constructor(id: string) { super('Equipment booking not found'); (this as any).code = 'EQ_BOOKING_NOT_FOUND'; (this as any).details = { id }; } }

export class InvalidRateError extends DomainError { constructor(message: string) { super('RATE_INVALID', message, 422); } }
export class InvalidBookingError extends DomainError { constructor(message: string) { super('BOOKING_INVALID', message, 422); } }
export class AssetNotBookableError extends DomainError { constructor(status: string) { super('ASSET_NOT_BOOKABLE', `Asset is not bookable (status: ${status})`, 409, { status }); } }
/** actual usage exceeds the agreed estimate — needs a re-quote (anti over-billing). */
export class OverEstimateError extends DomainError { constructor() { super('OVER_ESTIMATE', 'Actual quantity exceeds the agreed estimate; re-quote required', 422); } }
export class BookingStartOtpInvalidError extends AppError { constructor() { super('BOOKING_START_OTP_INVALID', 'Invalid start OTP', 403); } }
export class BookingStartOtpNotIssuedError extends DomainError { constructor() { super('BOOKING_START_OTP_NOT_ISSUED', 'No start OTP issued for this booking', 409); } }
export class EquipmentForbiddenError extends AppError { constructor(message = 'Not allowed on this equipment resource') { super('EQUIPMENT_FORBIDDEN', message, 403); } }
export class RegNoExistsError extends AppError { constructor() { super('REG_NO_EXISTS', 'An asset with this registration number already exists', 409); } }
