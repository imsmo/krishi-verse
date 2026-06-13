// shared/errors/error-codes.ts
// Central registry of stable machine error codes. Clients/i18n map off these,
// so codes are append-only and never renamed once shipped.
export const ErrorCodes = {
  // generic HTTP-shaped (see shared/errors/app-error.ts)
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  INTERNAL: 'INTERNAL',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  // listings domain
  LISTING_NOT_FOUND: 'LISTING_NOT_FOUND',
  LISTING_ILLEGAL_TRANSITION: 'LISTING_ILLEGAL_TRANSITION',
  LISTING_INSUFFICIENT_STOCK: 'LISTING_INSUFFICIENT_STOCK',
  LISTING_INVALID_PRICE: 'LISTING_INVALID_PRICE',
  LISTING_CONCURRENCY_CONFLICT: 'LISTING_CONCURRENCY_CONFLICT',
  LISTING_NOT_EDITABLE: 'LISTING_NOT_EDITABLE',
} as const;
export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
