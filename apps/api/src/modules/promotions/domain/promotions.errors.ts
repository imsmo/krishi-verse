// modules/promotions/domain/promotions.errors.ts · typed errors with stable codes.
import { AppError, DomainError, NotFoundError } from '../../../shared/errors/app-error';

export class PromotionNotFoundError extends NotFoundError { constructor(id: string) { super('Promotion not found'); (this as any).details = { id }; } }
export class CouponNotFoundError extends NotFoundError { constructor() { super('Coupon not found'); } }   // code is secret-ish → no echo
export class PromotionForbiddenError extends AppError { constructor(message = 'Not allowed') { super('PROMOTION_FORBIDDEN', message, 403); } }
export class InvalidPromotionError extends DomainError { constructor(message: string) { super('PROMOTION_INVALID', message, 400); } }
/** The coupon/promotion is paused, scheduled, expired, exhausted, or deleted. */
export class CouponNotActiveError extends AppError { constructor(status: string) { super('COUPON_NOT_ACTIVE', `Coupon is not active (${status})`, 409, { status }); } }
/** Order subtotal is below the promotion's minimum, or the discount computes to zero. */
export class CouponNotApplicableError extends AppError { constructor(message = 'Coupon is not applicable to this order') { super('COUPON_NOT_APPLICABLE', message, 409); } }
/** Coupon's total max_uses reached. */
export class CouponExhaustedError extends AppError { constructor() { super('COUPON_EXHAUSTED', 'This coupon has been fully redeemed', 409); } }
/** This user has hit the per-user redemption limit. */
export class CouponUserLimitError extends AppError { constructor() { super('COUPON_USER_LIMIT', 'You have already used this coupon the maximum number of times', 409); } }
/** Redeeming would exceed the promotion's remaining budget. */
export class PromotionBudgetExceededError extends AppError { constructor() { super('PROMOTION_BUDGET_EXCEEDED', 'This promotion has exhausted its budget', 409); } }
/** One coupon per (coupon, order) — UNIQUE in the schema. */
export class CouponCodeExistsError extends AppError { constructor() { super('COUPON_CODE_EXISTS', 'A coupon with this code already exists', 409); } }
export class DuplicateRedemptionError extends AppError { constructor() { super('COUPON_DUPLICATE_REDEMPTION', 'A coupon has already been applied to this order', 409); } }
