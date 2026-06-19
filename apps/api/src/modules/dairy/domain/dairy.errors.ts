// modules/dairy/domain/dairy.errors.ts · typed errors with stable codes (mapped to HTTP/i18n).
import { AppError, DomainError, NotFoundError } from '../../../shared/errors/app-error';

export class MccNotFoundError extends NotFoundError { constructor(id: string) { super('MCC centre not found'); (this as any).code = 'MCC_NOT_FOUND'; (this as any).details = { id }; } }
export class MembershipNotFoundError extends NotFoundError { constructor(id: string) { super('Dairy membership not found'); (this as any).code = 'DAIRY_MEMBERSHIP_NOT_FOUND'; (this as any).details = { id }; } }
export class RateCardNotFoundError extends NotFoundError { constructor(id: string) { super('Milk rate card not found'); (this as any).code = 'RATE_CARD_NOT_FOUND'; (this as any).details = { id }; } }
export class NoActiveRateCardError extends DomainError { constructor(animalType: string) { super('NO_ACTIVE_RATE_CARD', `No active milk rate card for animal type '${animalType}'`, 422, { animalType }); } }
export class CollectionNotFoundError extends NotFoundError { constructor(id: string) { super('Milk collection not found'); (this as any).code = 'COLLECTION_NOT_FOUND'; (this as any).details = { id }; } }
export class BillNotFoundError extends NotFoundError { constructor(id: string) { super('Milk bill not found'); (this as any).code = 'MILK_BILL_NOT_FOUND'; (this as any).details = { id }; } }

export class MccCodeExistsError extends AppError { constructor() { super('MCC_CODE_EXISTS', 'An MCC with this code already exists', 409); } }
export class MemberCodeExistsError extends AppError { constructor() { super('MEMBER_CODE_EXISTS', 'A membership with this member code already exists at this MCC', 409); } }
export class DuplicateCollectionError extends AppError { constructor() { super('DUPLICATE_COLLECTION', 'A collection for this member/shift/day already exists', 409); } }
export class InvalidRateCardError extends DomainError { constructor(message: string) { super('RATE_CARD_INVALID', message, 422); } }
export class InvalidCollectionError extends DomainError { constructor(message: string) { super('COLLECTION_INVALID', message, 422); } }
export class BillNotPayableError extends DomainError { constructor(status: string) { super('BILL_NOT_PAYABLE', `Milk bill cannot be paid from status '${status}'`, 409, { status }); } }
export class EmptyBillError extends DomainError { constructor() { super('EMPTY_BILL', 'No collections in the period to bill', 422); } }
export class DairyForbiddenError extends AppError { constructor(message = 'Not allowed on this dairy resource') { super('DAIRY_FORBIDDEN', message, 403); } }
