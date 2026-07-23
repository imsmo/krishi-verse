// modules/listings/domain/listing.errors.ts
// Typed domain errors — every failure has a stable code (mapped to HTTP +
// i18n key by core/http/exception.filter). Never throw bare Error in prod.
import { DomainError } from '../../../shared/errors/app-error';

export class ListingNotFoundError extends DomainError {
  constructor(id: string) { super('LISTING_NOT_FOUND', `Listing ${id} not found`, 404); }
}
export class SellerNotFoundError extends DomainError {
  constructor(id: string) { super('SELLER_NOT_FOUND', `Seller ${id} not found`, 404, { id }); }
}
export class IllegalListingTransitionError extends DomainError {
  constructor(from: string, to: string) {
    super('LISTING_ILLEGAL_TRANSITION', `Cannot move listing from ${from} to ${to}`, 409,
      { from, to });
  }
}
export class InsufficientStockError extends DomainError {
  constructor(requested: number, available: number) {
    super('LISTING_INSUFFICIENT_STOCK', `Requested ${requested} exceeds available ${available}`, 409,
      { requested, available });
  }
}
export class InvalidPriceError extends DomainError {
  constructor(reason: string) { super('LISTING_INVALID_PRICE', reason, 422); }
}
export class ListingConcurrencyError extends DomainError {
  constructor(id: string) {
    super('LISTING_CONCURRENCY_CONFLICT', `Listing ${id} was modified concurrently; retry`, 409);
  }
}
export class ListingNotEditableError extends DomainError {
  constructor(id: string, status: string) {
    super('LISTING_NOT_EDITABLE', `Listing ${id} cannot be edited in status ${status}`, 409, { status });
  }
}
export class InvalidRepostDurationError extends DomainError {
  constructor(days: number) { super('LISTING_INVALID_REPOST_DURATION', `Repost duration must be 1–60 days (got ${days})`, 422, { days }); }
}
export class InvalidExtendDurationError extends DomainError {
  constructor(days: number) { super('LISTING_INVALID_EXTEND_DURATION', `Extend duration must be 1–30 days (got ${days})`, 422, { days }); }
}
export class TrustDocumentMediaInvalidError extends DomainError {
  constructor() { super('LISTING_TRUST_DOCUMENT_MEDIA_INVALID', 'Media asset is not a clean, owned document', 422, {}); }
}
export class PhotoMediaInvalidError extends DomainError {
  constructor() { super('LISTING_PHOTO_MEDIA_INVALID', 'Media asset is not a clean, owned image', 422, {}); }
}
export class TooManyPhotosError extends DomainError {
  constructor(max: number) { super('LISTING_TOO_MANY_PHOTOS', `A listing may have at most ${max} photos`, 422, { max }); }
}
