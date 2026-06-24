// modules/orders/domain/orders.errors.ts · typed errors, stable codes → HTTP.
import { DomainError } from '../../../shared/errors/app-error';
export class CartNotFoundError extends DomainError { constructor() { super('CART_NOT_FOUND', 'Active cart not found', 404); } }
export class CartEmptyError extends DomainError { constructor() { super('CART_EMPTY', 'Cart is empty', 422); } }
export class OrderNotFoundError extends DomainError { constructor(id: string) { super('ORDER_NOT_FOUND', `Order ${id} not found`, 404); } }
export class OrderConcurrencyError extends DomainError { constructor(id: string) { super('ORDER_CONCURRENCY_CONFLICT', `Order ${id} was modified concurrently; retry`, 409); } }
export class ListingNotPurchasableError extends DomainError { constructor(id: string) { super('LISTING_NOT_PURCHASABLE', `Listing ${id} is not available for purchase`, 409, { listingId: id }); } }
export class InsufficientListingStockError extends DomainError { constructor(id: string, requested: number, available: number) { super('LISTING_INSUFFICIENT_STOCK', `Listing ${id}: requested ${requested} exceeds available ${available}`, 409, { listingId: id, requested, available }); } }
export class OrderForbiddenError extends DomainError { constructor(msg = 'Not allowed on this order') { super('ORDER_FORBIDDEN', msg, 403); } }
export class InvalidQuantityError extends DomainError { constructor() { super('ORDER_INVALID_QUANTITY', 'Quantity must be positive', 422); } }
export class OrderNotAwaitingPaymentError extends DomainError { constructor(id: string, status: string) { super('ORDER_NOT_AWAITING_PAYMENT', `Order ${id} is '${status}', not awaiting payment`, 409, { orderId: id, status }); } }
