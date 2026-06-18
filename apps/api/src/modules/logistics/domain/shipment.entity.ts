// modules/logistics/domain/shipment.entity.ts
// Shipment aggregate — the physical fulfilment of an order. Pure domain: status transitions ONLY via
// the state machine (Law 5); money (charge/COD) in bigint minor units. Proof-of-delivery is OTP-gated:
// the entity stores ONLY the HASH of the delivery OTP (the service hashes with the server pepper) and
// verifies a submitted hash in CONSTANT TIME — a DB dump never reveals the code. No version column
// (the table only has created_at/updated_at) → the service serializes mutations with SELECT … FOR UPDATE.
import { timingSafeEqual } from 'node:crypto';
import { ShipmentStatus, assertTransition } from './shipment.state';
import { ShipmentEventType, DomainEvent } from './logistics.events';
import { InvalidShipmentError, InvalidDeliveryOtpError, DeliveryOtpNotIssuedError } from './logistics.errors';

export interface ShipmentProps {
  id: string; tenantId: string; orderId: string; partnerId: string | null; vehicleId: string | null; riderUserId: string | null;
  status: ShipmentStatus; awbNo: string | null; pickupAddressId: string | null; dropAddressId: string | null;
  scheduledPickupAt: Date | null; scheduledWindowMins: number | null; pickedUpAt: Date | null; deliveredAt: Date | null;
  pickupOtpHash: string | null; deliveryOtpHash: string | null; podMediaId: string | null;
  chargeMinor: bigint | null; codMinor: bigint | null; requiresColdChain: boolean; createdAt: Date;
}

export class Shipment {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: ShipmentProps) {}

  static create(input: {
    id: string; tenantId: string; orderId: string; pickupAddressId?: string | null; dropAddressId?: string | null;
    chargeMinor?: bigint | null; codMinor?: bigint | null; requiresColdChain?: boolean; now?: Date;
  }): Shipment {
    if ((input.chargeMinor ?? 0n) < 0n) throw new InvalidShipmentError('charge cannot be negative');
    if ((input.codMinor ?? 0n) < 0n) throw new InvalidShipmentError('COD cannot be negative');
    const s = new Shipment({
      id: input.id, tenantId: input.tenantId, orderId: input.orderId, partnerId: null, vehicleId: null, riderUserId: null,
      status: 'pending', awbNo: null, pickupAddressId: input.pickupAddressId ?? null, dropAddressId: input.dropAddressId ?? null,
      scheduledPickupAt: null, scheduledWindowMins: null, pickedUpAt: null, deliveredAt: null,
      pickupOtpHash: null, deliveryOtpHash: null, podMediaId: null,
      chargeMinor: input.chargeMinor ?? null, codMinor: input.codMinor ?? null, requiresColdChain: input.requiresColdChain ?? false,
      createdAt: input.now ?? new Date(),
    });
    s.events.push({ type: ShipmentEventType.Created, payload: { shipmentId: s.props.id, orderId: s.props.orderId } });
    return s;
  }
  static rehydrate(props: ShipmentProps): Shipment { return new Shipment(props); }

  get id() { return this.props.id; }
  get status() { return this.props.status; }
  get orderId() { return this.props.orderId; }
  get riderUserId() { return this.props.riderUserId; }
  get requiresOtp() { return this.props.deliveryOtpHash != null; }
  toProps(): Readonly<ShipmentProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  /** Assign a 3PL/fleet partner, a vehicle, and/or a rider. */
  assign(input: { partnerId?: string | null; vehicleId?: string | null; riderUserId?: string | null; awbNo?: string | null }): void {
    this.props.partnerId = input.partnerId ?? this.props.partnerId;
    this.props.vehicleId = input.vehicleId ?? this.props.vehicleId;
    this.props.riderUserId = input.riderUserId ?? this.props.riderUserId;
    this.props.awbNo = input.awbNo ?? this.props.awbNo;
    this.to('assigned', ShipmentEventType.Assigned, { riderUserId: this.props.riderUserId });
  }
  schedulePickup(at: Date, windowMins: number | null): void {
    this.props.scheduledPickupAt = at; this.props.scheduledWindowMins = windowMins;
    this.to('pickup_scheduled', ShipmentEventType.PickupScheduled, { scheduledPickupAt: at.toISOString() });
  }
  markPickedUp(now: Date = new Date()): void { this.props.pickedUpAt = now; this.to('picked_up', ShipmentEventType.PickedUp, {}); }
  markInTransit(): void { this.to('in_transit', ShipmentEventType.InTransit, {}); }
  markAtHub(): void { this.to('at_hub', ShipmentEventType.AtHub, {}); }

  /** Dispatch for final delivery. The delivery OTP hash (computed by the service from a fresh code)
   *  is stored now; the raw code is SMS'd to the buyer out-of-band (the service emits the issue event). */
  markOutForDelivery(deliveryOtpHash: string): void {
    if (!deliveryOtpHash) throw new InvalidShipmentError('delivery OTP hash required to dispatch');
    this.props.deliveryOtpHash = deliveryOtpHash;
    this.to('out_for_delivery', ShipmentEventType.OutForDelivery, {});
  }

  /** Proof-of-delivery: the rider submits the buyer's OTP (already hashed by the service). The hash
   *  must match the issued one in CONSTANT TIME. Optional POD media (signed photo) is recorded. */
  markDelivered(submittedOtpHash: string | null, podMediaId: string | null, now: Date = new Date()): void {
    if (!this.props.deliveryOtpHash) throw new DeliveryOtpNotIssuedError();
    if (!this.otpMatches(submittedOtpHash)) throw new InvalidDeliveryOtpError();
    this.props.deliveredAt = now;
    if (podMediaId) this.props.podMediaId = podMediaId;
    this.to('delivered', ShipmentEventType.Delivered, { orderId: this.props.orderId });
  }

  markFailed(reason: string): void { this.to('failed', ShipmentEventType.Failed, { reason }); }
  markReturned(): void { this.to('returned', ShipmentEventType.Returned, {}); }
  cancel(): void { this.to('cancelled', ShipmentEventType.Cancelled, {}); }

  private otpMatches(submittedHash: string | null): boolean {
    const stored = this.props.deliveryOtpHash;
    if (!stored || !submittedHash) return false;
    const a = Buffer.from(stored); const b = Buffer.from(submittedHash);
    return a.length === b.length && timingSafeEqual(a, b);
  }
  private to(status: ShipmentStatus, evt: string, payload: Record<string, unknown>): void {
    assertTransition(this.props.status, status);
    this.props.status = status;
    this.events.push({ type: evt, payload: { shipmentId: this.props.id, orderId: this.props.orderId, ...payload } });
  }
}
