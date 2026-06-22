// modules/memberships/domain/user-membership.entity.ts
// UserMembership aggregate — a user's subscription to a tier. Pure domain: status transitions ONLY via
// the state machine (Law 5). The fee MOVES only via the wallet boundary (the service posts it); this
// entity records the period + status. No version column → the service locks the row FOR UPDATE.
import { MembershipStatus, assertTransition, isLive } from './user-membership.state';
import { MembershipEventType, DomainEvent, BillingCycle } from './memberships.events';
import { MembershipNotLiveError } from './memberships.errors';

export interface UserMembershipProps {
  id: string; tenantId: string; userId: string; tierId: string; status: MembershipStatus;
  billingCycle: BillingCycle; currentPeriodEnd: Date | null; paymentId: string | null; createdAt: Date;
}

/** Advance a YYYY-MM-DD period end by one billing cycle from `from`. */
export function nextPeriodEnd(from: Date, cycle: BillingCycle): Date {
  const d = new Date(from.getTime());
  if (cycle === 'annual') d.setUTCFullYear(d.getUTCFullYear() + 1); else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

export class UserMembership {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: UserMembershipProps) {}

  static subscribe(input: { id: string; tenantId: string; userId: string; tierId: string; billingCycle: BillingCycle; now?: Date }): UserMembership {
    const now = input.now ?? new Date();
    const m = new UserMembership({ id: input.id, tenantId: input.tenantId, userId: input.userId, tierId: input.tierId, status: 'active',
      billingCycle: input.billingCycle, currentPeriodEnd: nextPeriodEnd(now, input.billingCycle), paymentId: null, createdAt: now });
    m.events.push({ type: MembershipEventType.Subscribed, payload: { membershipId: m.props.id, userId: m.props.userId, tierId: m.props.tierId, billingCycle: m.props.billingCycle, currentPeriodEnd: m.props.currentPeriodEnd?.toISOString() } });
    return m;
  }
  static rehydrate(props: UserMembershipProps): UserMembership { return new UserMembership(props); }

  get id() { return this.props.id; }
  get status() { return this.props.status; }
  get userId() { return this.props.userId; }
  get tierId() { return this.props.tierId; }
  get currentPeriodEnd() { return this.props.currentPeriodEnd; }
  toProps(): Readonly<UserMembershipProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  /** Extend the paid-through date by one cycle (the service charges the wallet alongside). */
  renew(now: Date = new Date()): void {
    if (!isLive(this.props.status)) throw new MembershipNotLiveError(this.props.status);
    const base = this.props.currentPeriodEnd && this.props.currentPeriodEnd.getTime() > now.getTime() ? this.props.currentPeriodEnd : now;
    this.props.currentPeriodEnd = nextPeriodEnd(base, this.props.billingCycle);
    if (this.props.status === 'past_due') this.props.status = 'active';
    this.events.push({ type: MembershipEventType.Renewed, payload: { membershipId: this.props.id, currentPeriodEnd: this.props.currentPeriodEnd?.toISOString() } });
  }

  /** A gateway/card payment for this subscription settled (payments.payment_succeeded, referenceType
   *  'membership'). Stamp the payment reference exactly once and ensure the member is live. IDEMPOTENT:
   *  a relay re-delivery (or the wallet-debit path that already activated the subscription) finds the
   *  paymentId already set and is a no-op — no event, no state thrash. Returns whether it confirmed now. */
  confirmPayment(paymentId: string): boolean {
    if (!paymentId) return false;
    if (this.props.paymentId) return false;                       // already confirmed → idempotent no-op
    if (this.props.status === 'cancelled' || this.props.status === 'expired') return false;   // a settled payment never resurrects a dead membership
    this.props.paymentId = paymentId;
    if (this.props.status === 'past_due') this.props.status = 'active';
    this.events.push({ type: MembershipEventType.PaymentConfirmed, payload: { membershipId: this.props.id, userId: this.props.userId, paymentId } });
    return true;
  }

  cancel(): void {
    if (!isLive(this.props.status)) throw new MembershipNotLiveError(this.props.status);
    assertTransition(this.props.status, 'cancelled');
    this.props.status = 'cancelled';
    this.events.push({ type: MembershipEventType.Cancelled, payload: { membershipId: this.props.id, userId: this.props.userId } });
  }

  /** Worker job: lapse a live membership whose paid period has ended. */
  expire(now: Date = new Date()): boolean {
    if (!isLive(this.props.status)) return false;
    if (this.props.currentPeriodEnd && this.props.currentPeriodEnd.getTime() > now.getTime()) return false;
    assertTransition(this.props.status, 'expired');
    this.props.status = 'expired';
    this.events.push({ type: MembershipEventType.Expired, payload: { membershipId: this.props.id, userId: this.props.userId } });
    return true;
  }
}
