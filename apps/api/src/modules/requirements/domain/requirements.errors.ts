// modules/requirements/domain/requirements.errors.ts · typed errors with stable codes.
import { AppError, DomainError, NotFoundError } from '../../../shared/errors/app-error';

export class RequirementNotFoundError extends NotFoundError { constructor(id: string) { super('Requirement not found'); (this as any).details = { id }; } }
export class ResponseNotFoundError extends NotFoundError { constructor(id: string) { super('Quote not found'); (this as any).details = { id }; } }
/** Acting on a requirement that is no longer soliciting/usable (fulfilled/expired/closed). */
export class RequirementNotOpenError extends AppError { constructor(status: string) { super('REQUIREMENT_NOT_OPEN', `Requirement is not open (status: ${status})`, 409, { status }); } }
/** Acting on a quote that is no longer live (accepted/rejected/expired). */
export class ResponseNotLiveError extends AppError { constructor(status: string) { super('RESPONSE_NOT_LIVE', `Quote is not live (status: ${status})`, 409, { status }); } }
/** The actor is not the requirement's buyer / the quote's seller / a moderator, as required. */
export class RequirementForbiddenError extends AppError { constructor(message = 'Not allowed on this requirement') { super('REQUIREMENT_FORBIDDEN', message, 403); } }
/** A seller cannot quote on their OWN requirement (no self-deal). */
export class SellerIsBuyerError extends AppError { constructor() { super('REQUIREMENT_SELF_QUOTE', 'You cannot quote on your own requirement', 403); } }
/** A quote can only become an order if it references a listing (order_items needs a listing+product). */
export class ResponseNotAcceptableError extends AppError { constructor() { super('RESPONSE_NOT_ACCEPTABLE', 'Quote must reference a listing before it can be accepted into an order', 409); } }
/** One quote per (requirement, seller) — UNIQUE in the schema. */
export class DuplicateResponseError extends AppError { constructor() { super('RESPONSE_DUPLICATE', 'You have already quoted on this requirement', 409); } }
export class InvalidRequirementError extends DomainError { constructor(message: string) { super('REQUIREMENT_INVALID', message, 400); } }
export class InvalidResponseError extends DomainError { constructor(message: string) { super('RESPONSE_INVALID', message, 400); } }
