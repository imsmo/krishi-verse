// modules/services-marketplace/domain/service-booking.entity.ts · the service_bookings aggregate root.
// The customer books a provider's offering; the fee (total_minor, snapshotted from the offering price ×
// guests) is settled customer → provider on completion via the wallet (Law 2). Lifecycle via the state
// machine. No version → repo locks FOR UPDATE.
import { BookingStatus, assertTransition, isCompletable } from './service-booking.state';
import { DomainEvent, ServicesEventType } from './services-marketplace.events';
import { BookingNotCompletableError } from './services-marketplace.errors';

export interface ServiceBookingProps {
  id: string; tenantId: string; offeringId: string; providerUserId: string; customerUserId: string; bookingNo: string;
  startsAt: Date; endsAt: Date | null; guests: number; totalMinor: bigint; status: BookingStatus; notes: string | null; createdAt?: Date;
}
export class ServiceBooking {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: ServiceBookingProps) {}
  static request(input: Omit<ServiceBookingProps, 'status'>): ServiceBooking {
    const b = new ServiceBooking({ ...input, status: 'requested' });
    b.events.push({ type: ServicesEventType.BookingRequested, payload: { bookingId: b.props.id, offeringId: b.props.offeringId, customerUserId: b.props.customerUserId, providerUserId: b.props.providerUserId, totalMinor: b.props.totalMinor.toString() } });
    return b;
  }
  static rehydrate(props: ServiceBookingProps): ServiceBooking { return new ServiceBooking(props); }
  get id() { return this.props.id; }
  get tenantId() { return this.props.tenantId; }
  get providerUserId() { return this.props.providerUserId; }
  get customerUserId() { return this.props.customerUserId; }
  get status() { return this.props.status; }
  get totalMinor() { return this.props.totalMinor; }
  toProps(): Readonly<ServiceBookingProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }
  private transition(to: BookingStatus, eventType: string, extra: Record<string, unknown> = {}): void {
    const from = this.props.status; assertTransition(from, to); this.props.status = to;
    this.events.push({ type: eventType, payload: { bookingId: this.props.id, from, to, ...extra } });
  }
  confirm(): void { this.transition('confirmed', ServicesEventType.BookingConfirmed); }
  start(): void { this.transition('in_progress', ServicesEventType.BookingStarted); }
  /** Customer confirms the service was rendered → completed (fee settled by the service in the same tx). */
  complete(): void {
    if (!isCompletable(this.props.status)) throw new BookingNotCompletableError(this.props.status);
    this.transition('completed', ServicesEventType.BookingCompleted, { totalMinor: this.props.totalMinor.toString() });
  }
  cancel(reason?: string): void { this.transition('cancelled', ServicesEventType.BookingCancelled, reason ? { reason } : {}); }
  toJSON() { const v = this.props; return { id: v.id, offeringId: v.offeringId, providerUserId: v.providerUserId, customerUserId: v.customerUserId, bookingNo: v.bookingNo,
    startsAt: v.startsAt, endsAt: v.endsAt, guests: v.guests, totalMinor: v.totalMinor.toString(), status: v.status, notes: v.notes, createdAt: v.createdAt }; }
}
