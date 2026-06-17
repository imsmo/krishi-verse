// modules/auctions/domain/auctions.errors.ts · typed errors with stable codes.
import { AppError, DomainError, NotFoundError } from '../../../shared/errors/app-error';

export class AuctionNotFoundError extends NotFoundError { constructor(id: string) { super('Auction not found'); (this as any).details = { id }; } }
export class AuctionNotBiddableError extends AppError { constructor(status: string) { super('AUCTION_NOT_BIDDABLE', `Auction is not accepting bids (status: ${status})`, 409, { status }); } }
/** Bid below start price or below current high + minimum increment. */
export class BidTooLowError extends DomainError { constructor(minMinor: bigint) { super('BID_TOO_LOW', `Bid must be at least ${minMinor}`, 409, { minMinor: minMinor.toString() }); } }
/** A bidder cannot outbid themselves (already the high bidder) / self-deal. */
export class AlreadyHighBidderError extends AppError { constructor() { super('ALREADY_HIGH_BIDDER', 'You are already the highest bidder', 409); } }
/** The listing's seller cannot bid on their own auction. */
export class SellerCannotBidError extends AppError { constructor() { super('SELLER_CANNOT_BID', 'The seller cannot bid on their own auction', 403); } }
export class BidderNotQualifiedError extends AppError { constructor(reason: string) { super('BIDDER_NOT_QUALIFIED', `Not qualified to bid: ${reason}`, 403, { reason }); } }
export class AuctionConcurrencyError extends AppError { constructor(id: string) { super('AUCTION_CONCURRENCY', 'Auction changed concurrently; retry', 409, { id }); } }
export class AuctionForbiddenError extends AppError { constructor(message = 'Not allowed on this auction') { super('AUCTION_FORBIDDEN', message, 403); } }
export class InvalidAuctionError extends DomainError { constructor(message: string) { super('AUCTION_INVALID', message, 400); } }
