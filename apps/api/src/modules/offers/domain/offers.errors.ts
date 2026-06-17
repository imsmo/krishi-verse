// modules/offers/domain/offers.errors.ts · typed errors with stable codes.
import { AppError, DomainError, NotFoundError } from '../../../shared/errors/app-error';

export class OfferNotFoundError extends NotFoundError { constructor(id: string) { super('Offer not found'); (this as any).details = { id }; } }
/** Acting on an offer that is no longer in active negotiation (rejected/expired/accepted/converted). */
export class OfferNotNegotiableError extends AppError { constructor(status: string) { super('OFFER_NOT_NEGOTIABLE', `Offer is not in active negotiation (status: ${status})`, 409, { status }); } }
/** A party tried to act when it is the other party's turn to respond. */
export class NotYourTurnError extends AppError { constructor(party: string) { super('OFFER_NOT_YOUR_TURN', `It is not the ${party}'s turn to act`, 409, { party }); } }
/** The actor is neither the buyer nor the listing's seller (nor a moderator). */
export class OfferForbiddenError extends AppError { constructor(message = 'Not a party to this offer') { super('OFFER_FORBIDDEN', message, 403); } }
/** The offer's expires_at has passed. */
export class OfferExpiredError extends AppError { constructor() { super('OFFER_EXPIRED', 'Offer has expired', 409); } }
/** Bad price/quantity/listing at make/counter time. */
export class InvalidOfferError extends DomainError { constructor(message: string) { super('OFFER_INVALID', message, 400); } }
/** Buyer cannot make an offer on their own listing (no self-deal). */
export class SellerCannotOfferError extends AppError { constructor() { super('SELLER_CANNOT_OFFER', 'The seller cannot make an offer on their own listing', 403); } }
