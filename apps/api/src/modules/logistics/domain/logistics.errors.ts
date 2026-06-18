// modules/logistics/domain/logistics.errors.ts · typed errors with stable codes.
import { AppError, DomainError, NotFoundError } from '../../../shared/errors/app-error';

export class ShipmentNotFoundError extends NotFoundError { constructor(id: string) { super('Shipment not found'); (this as any).details = { id }; } }
/** The actor is not a tenant logistics operator nor the assigned rider for this shipment. */
export class ShipmentForbiddenError extends AppError { constructor(message = 'Not allowed on this shipment') { super('SHIPMENT_FORBIDDEN', message, 403); } }
/** Delivery requires a valid proof-of-delivery OTP and the submitted one did not match. */
export class InvalidDeliveryOtpError extends AppError { constructor() { super('SHIPMENT_INVALID_OTP', 'Invalid or missing delivery OTP', 403); } }
/** A delivery was attempted but the shipment has no issued OTP to verify against. */
export class DeliveryOtpNotIssuedError extends AppError { constructor() { super('SHIPMENT_OTP_NOT_ISSUED', 'No delivery OTP has been issued; dispatch the shipment first', 409); } }
export class InvalidShipmentError extends DomainError { constructor(message: string) { super('SHIPMENT_INVALID', message, 400); } }
/** One shipment per order (idempotent creation). */
export class ShipmentExistsError extends AppError { constructor(orderId: string) { super('SHIPMENT_EXISTS', 'A shipment already exists for this order', 409, { orderId }); } }
