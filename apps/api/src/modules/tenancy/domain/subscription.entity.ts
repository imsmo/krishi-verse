// modules/tenancy/domain/subscription.entity.ts
// Subscription aggregate — a tenant's subscription to a plan; the ACTIVE one drives that tenant's
// quotas (core QuotaService). Pure domain: price in bigint minor units, status transitions ONLY via the
// state machine (Law 5). No SaaS money moves here (B2B billing via saas_invoices is a separate, deferred
// flow). No version column → the service locks the row FOR UPDATE.
import { SubscriptionStatus, assertTransition, isLive } from './subscription.state';
import { TenancyEventType, DomainEvent, BillingCycle } from './tenancy.events';
import { InvalidSubscriptionError, SubscriptionNotLiveError } from './tenancy.errors';

export interface SubscriptionProps {
  id: string; tenantId: string; planId: string; status: SubscriptionStatus; billingCycle: BillingCycle;
  priceMinor: bigint; currencyCode: string; discountPct: number; currentPeriodStart: Date; currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean; cancelledAt: Date | null; createdAt: Date;
}
function nextPeriodEnd(from: Date, cycle: BillingCycle): Date {
  const d = new Date(from.getTime());
  if (cycle === 'annual') d.setUTCFullYear(d.getUTCFullYear() + 1); else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

export class Subscription {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: SubscriptionProps) {}

  /** Activate a tenant on a plan. Starts 'active' so quotas apply immediately (trial flows are future). */
  static subscribe(input: { id: string; tenantId: string; planId: string; billingCycle: BillingCycle; priceMinor: bigint; currencyCode: string; discountPct?: number; now?: Date }): Subscription {
    const now = input.now ?? new Date();
    if (input.priceMinor < 0n) throw new InvalidSubscriptionError('price cannot be negative');
    const s = new Subscription({ id: input.id, tenantId: input.tenantId, planId: input.planId, status: 'active', billingCycle: input.billingCycle,
      priceMinor: input.priceMinor, currencyCode: input.currencyCode, discountPct: input.discountPct ?? 0, currentPeriodStart: now, currentPeriodEnd: nextPeriodEnd(now, input.billingCycle),
      cancelAtPeriodEnd: false, cancelledAt: null, createdAt: now });
    s.events.push({ type: TenancyEventType.Subscribed, payload: { subscriptionId: s.props.id, tenantId: s.props.tenantId, planId: s.props.planId, billingCycle: s.props.billingCycle } });
    return s;
  }
  static rehydrate(props: SubscriptionProps): Subscription { return new Subscription(props); }

  get id() { return this.props.id; }
  get tenantId() { return this.props.tenantId; }
  get planId() { return this.props.planId; }
  get status() { return this.props.status; }
  get currentPeriodEnd() { return this.props.currentPeriodEnd; }
  toProps(): Readonly<SubscriptionProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  /** Switch to a different plan (price re-quoted by the service). Keeps the period; quotas follow the new plan. */
  changePlan(newPlanId: string, newPriceMinor: bigint): void {
    if (!isLive(this.props.status)) throw new SubscriptionNotLiveError(this.props.status);
    if (newPriceMinor < 0n) throw new InvalidSubscriptionError('price cannot be negative');
    const from = this.props.planId;
    this.props.planId = newPlanId; this.props.priceMinor = newPriceMinor;
    if (this.props.status !== 'active') { assertTransition(this.props.status, 'active'); this.props.status = 'active'; }
    this.events.push({ type: TenancyEventType.PlanChanged, payload: { subscriptionId: this.props.id, fromPlanId: from, toPlanId: newPlanId } });
  }

  /** Cancel now (status cancelled) or at period end (stays active until the grace job expires it). */
  cancel(atPeriodEnd: boolean, now: Date = new Date()): void {
    if (!isLive(this.props.status)) throw new SubscriptionNotLiveError(this.props.status);
    this.props.cancelledAt = now;
    if (atPeriodEnd) { this.props.cancelAtPeriodEnd = true; this.events.push({ type: TenancyEventType.SubscriptionCancelled, payload: { subscriptionId: this.props.id, atPeriodEnd: true } }); return; }
    assertTransition(this.props.status, 'cancelled');
    this.props.status = 'cancelled';
    this.events.push({ type: TenancyEventType.SubscriptionCancelled, payload: { subscriptionId: this.props.id, atPeriodEnd: false } });
  }

  /** Worker job: lapse a subscription past its period end (or a cancel-at-period-end that has arrived). */
  expire(now: Date = new Date()): boolean {
    if (!isLive(this.props.status)) return false;
    if (this.props.currentPeriodEnd.getTime() > now.getTime()) return false;
    assertTransition(this.props.status, 'expired');
    this.props.status = 'expired';
    this.events.push({ type: TenancyEventType.SubscriptionExpired, payload: { subscriptionId: this.props.id, tenantId: this.props.tenantId } });
    return true;
  }
}
