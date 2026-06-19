// modules/livestock/domain/vet-booking.entity.ts · the vet_bookings aggregate root (pure domain).
// The vet drives the service lifecycle (accept→en_route→in_consult→prescribed); the FARMER (payer) confirms
// completion, settling the fee through the wallet (Law 2). fee_minor is bigint minor units, snapshotted from
// the vet_service price at booking. No version column → the repo locks the row FOR UPDATE for concurrency.
import { VetBookingStatus, assertTransition, isCompletable } from './vet-booking.state';
import { LivestockEventType, DomainEvent } from './livestock.events';
import { BookingNotCompletableError } from './livestock.errors';

export interface VetBookingProps {
  id: string;
  tenantId: string;
  farmerUserId: string;
  vetId: string;
  serviceId: string;
  animalId: string | null;
  urgency: string;
  mode: string;
  symptomsText: string | null;
  scheduledAt: Date | null;
  status: VetBookingStatus;
  feeMinor: bigint;
  completedAt: Date | null;
  createdAt?: Date;
}
export class VetBooking {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: VetBookingProps) {}

  static request(input: Omit<VetBookingProps, 'status' | 'completedAt'>): VetBooking {
    const b = new VetBooking({ ...input, status: 'requested', completedAt: null });
    b.events.push({ type: LivestockEventType.VetBookingRequested, payload: { bookingId: b.props.id, farmerUserId: b.props.farmerUserId, vetId: b.props.vetId, feeMinor: b.props.feeMinor.toString() } });
    return b;
  }
  static rehydrate(props: VetBookingProps): VetBooking { return new VetBooking(props); }

  get id() { return this.props.id; }
  get tenantId() { return this.props.tenantId; }
  get farmerUserId() { return this.props.farmerUserId; }
  get vetId() { return this.props.vetId; }
  get status() { return this.props.status; }
  get feeMinor() { return this.props.feeMinor; }
  toProps(): Readonly<VetBookingProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  private transition(to: VetBookingStatus, eventType: string, extra: Record<string, unknown> = {}): void {
    const from = this.props.status;
    assertTransition(from, to);
    this.props.status = to;
    this.events.push({ type: eventType, payload: { bookingId: this.props.id, from, to, ...extra } });
  }

  // ---- vet-driven lifecycle ----
  accept(): void { this.transition('accepted', LivestockEventType.VetBookingAccepted); }
  enRoute(): void { this.transition('en_route', LivestockEventType.VetBookingProgressed, { to: 'en_route' }); }
  startConsult(): void { this.transition('in_consult', LivestockEventType.VetBookingProgressed, { to: 'in_consult' }); }
  prescribe(): void { this.transition('prescribed', LivestockEventType.VetBookingProgressed, { to: 'prescribed' }); }
  noShow(): void { this.transition('no_show', LivestockEventType.VetBookingNoShow); }

  // ---- farmer-driven ----
  cancel(reason?: string): void { this.transition('cancelled', LivestockEventType.VetBookingCancelled, reason ? { reason } : {}); }
  /** Farmer confirms the service was rendered → completed (fee is settled by the service in the same tx). */
  complete(now: Date): void {
    if (!isCompletable(this.props.status)) throw new BookingNotCompletableError(this.props.status);
    this.transition('completed', LivestockEventType.VetBookingCompleted, { feeMinor: this.props.feeMinor.toString() });
    this.props.completedAt = now;
  }
}
