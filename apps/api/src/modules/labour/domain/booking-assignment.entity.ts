// modules/labour/domain/booking-assignment.entity.ts · the booking_assignments aggregate (one per worker
// per booking). The worker CONSENTS (accept) or declines (reject); accepted assignments are what the wage
// settlement pays. No version column → the repo locks the row FOR UPDATE for concurrency. Money is bigint.
import { AssignmentStatus, assertTransition } from './booking-assignment.state';
import { LabourEventType, DomainEvent } from './labour.events';

export interface BookingAssignmentProps {
  id: string;
  bookingId: string;
  tenantId: string;
  workerId: string;
  status: AssignmentStatus;
  acceptedAt: Date | null;
  voiceConsentMediaId: string | null;
  wageMinor: bigint;
  createdAt?: Date;
}

export class BookingAssignment {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: BookingAssignmentProps) {}

  static create(input: { id: string; bookingId: string; tenantId: string; workerId: string; wageMinor: bigint }): BookingAssignment {
    const a = new BookingAssignment({ ...input, status: 'pending_worker', acceptedAt: null, voiceConsentMediaId: null });
    a.events.push({ type: LabourEventType.WorkerAssigned, payload: { assignmentId: a.props.id, bookingId: a.props.bookingId, workerId: a.props.workerId, wageMinor: a.props.wageMinor.toString() } });
    return a;
  }

  /** Worker SELF-APPLIES to an OPEN booking (status 'applied' — an interest pool, not a committed slot). */
  static apply(input: { id: string; bookingId: string; tenantId: string; workerId: string; wageMinor: bigint }): BookingAssignment {
    const a = new BookingAssignment({ ...input, status: 'applied', acceptedAt: null, voiceConsentMediaId: null });
    a.events.push({ type: LabourEventType.WorkerAssigned, payload: { assignmentId: a.props.id, bookingId: a.props.bookingId, workerId: a.props.workerId, wageMinor: a.props.wageMinor.toString(), applied: true } });
    return a;
  }
  static rehydrate(props: BookingAssignmentProps): BookingAssignment { return new BookingAssignment(props); }

  get id() { return this.props.id; }
  get bookingId() { return this.props.bookingId; }
  get tenantId() { return this.props.tenantId; }
  get workerId() { return this.props.workerId; }
  get status() { return this.props.status; }
  get wageMinor() { return this.props.wageMinor; }
  toProps(): Readonly<BookingAssignmentProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  private transition(to: AssignmentStatus, eventType: string, extra: Record<string, unknown> = {}): void {
    const from = this.props.status;
    assertTransition(from, to);
    this.props.status = to;
    this.events.push({ type: eventType, payload: { assignmentId: this.props.id, bookingId: this.props.bookingId, workerId: this.props.workerId, from, to, ...extra } });
  }

  /** Worker consents to the engagement (pending_worker → accepted), optionally with a voice-consent recording. */
  accept(now: Date, voiceConsentMediaId?: string | null): void {
    this.transition('accepted', LabourEventType.AssignmentAccepted);
    this.props.acceptedAt = now;
    if (voiceConsentMediaId) this.props.voiceConsentMediaId = voiceConsentMediaId;
  }
  /** Worker declines (pending_worker → rejected). */
  reject(): void { this.transition('rejected', LabourEventType.AssignmentRejected); }
  /** Worker job: lapsed unanswered past respond_by (pending_worker → expired). */
  expire(): void { this.transition('expired', LabourEventType.AssignmentExpired); }
  /** Wage settled (accepted → paid). */
  markPaid(): void { this.transition('paid', LabourEventType.WagesPaid); }
}
