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

// ---- fleet registry (partners / vehicles / pickup-slots) ----
export class PartnerNotFoundError extends NotFoundError { constructor(id: string) { super('Logistics partner not found'); (this as any).details = { id }; } }
export class VehicleNotFoundError extends NotFoundError { constructor(id: string) { super('Vehicle not found'); (this as any).details = { id }; } }
export class PickupSlotNotFoundError extends NotFoundError { constructor(id: string) { super('Pickup slot not found'); (this as any).details = { id }; } }
export class InvalidPartnerError extends DomainError { constructor(message: string) { super('PARTNER_INVALID', message, 422); } }
export class InvalidVehicleError extends DomainError { constructor(message: string) { super('VEHICLE_INVALID', message, 422); } }
export class InvalidPickupSlotError extends DomainError { constructor(message: string) { super('PICKUP_SLOT_INVALID', message, 422); } }
/** UNIQUE(partner_id, reg_no) — a vehicle with this plate already exists for the partner. */
export class DuplicateVehicleRegError extends AppError { constructor(regNo: string) { super('VEHICLE_REG_EXISTS', `A vehicle with reg_no ${regNo} already exists for this partner`, 409, { regNo }); } }
/** activate/deactivate (or a patch) is a no-op — the entity is already in the requested state. */
export class FleetAlreadyInStateError extends AppError { constructor(kind: string) { super('FLEET_ALREADY_IN_STATE', `${kind} is already in the requested state`, 409, { kind }); } }
