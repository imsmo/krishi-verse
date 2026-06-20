// modules/ambassadors/domain/referral.entity.ts · the generic referral aggregate (referrer → referee).
// Lifecycle invited→signed_up→activated→rewarded (Law 5). A referrer who is an ambassador earns on activation.
// code is unique per (tenant, code, referee). No version → repo locks FOR UPDATE on transitions.
import { ReferralStatus, DomainEvent, AmbassadorEventType } from './ambassadors.events';
import { assertTransition } from './referral.state';
import { InvalidReferralError } from './ambassadors.errors';

export interface ReferralProps {
  id: string; tenantId: string; referrerUserId: string; refereeUserId: string | null; code: string;
  status: ReferralStatus; rewardRule: Record<string, unknown>; rewardTxnId: string | null; createdAt?: Date;
}
const CODE_RE = /^[A-Z0-9]{4,20}$/;   // anchored, ReDoS-safe

export class Referral {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: ReferralProps) {}

  static create(input: Omit<ReferralProps, 'status' | 'rewardTxnId'>): Referral {
    if (!CODE_RE.test(input.code)) throw new InvalidReferralError('code must be 4-20 uppercase alphanumerics');
    const r = new Referral({ ...input, status: 'invited', rewardTxnId: null });
    r.events.push({ type: AmbassadorEventType.ReferralCreated, payload: { referralId: r.props.id, referrerUserId: r.props.referrerUserId, code: r.props.code } });
    return r;
  }
  static rehydrate(p: ReferralProps): Referral { return new Referral(p); }
  get id() { return this.props.id; }
  get referrerUserId() { return this.props.referrerUserId; }
  get refereeUserId() { return this.props.refereeUserId; }
  get status() { return this.props.status; }
  toProps(): Readonly<ReferralProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  signUp(refereeUserId: string): void {
    assertTransition(this.props.status, 'signed_up');
    if (refereeUserId === this.props.referrerUserId) throw new InvalidReferralError('cannot refer yourself');
    this.props.status = 'signed_up'; this.props.refereeUserId = refereeUserId;
  }
  activate(): void {
    assertTransition(this.props.status, 'activated');
    this.props.status = 'activated';
    this.events.push({ type: AmbassadorEventType.ReferralActivated, payload: { referralId: this.props.id, referrerUserId: this.props.referrerUserId, refereeUserId: this.props.refereeUserId } });
  }
  markRewarded(rewardTxnId: string | null): void { assertTransition(this.props.status, 'rewarded'); this.props.status = 'rewarded'; this.props.rewardTxnId = rewardTxnId; }
  toJSON() { const v = this.props; return { id: v.id, referrerUserId: v.referrerUserId, refereeUserId: v.refereeUserId, code: v.code, status: v.status, createdAt: v.createdAt }; }
}
