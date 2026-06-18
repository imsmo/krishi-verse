// modules/disputes/domain/dispute.entity.ts
// Dispute aggregate — a buyer↔seller disagreement on a delivered order, worked to a resolution. Pure
// domain: status transitions ONLY via the state machine (Law 5); the resolution AMOUNT is bigint minor
// units (no money moves here — the resolved event drives the refund/release downstream). No version
// column (add_std_columns) → the service serializes mutations with SELECT … FOR UPDATE.
import { DisputeStatus, assertTransition, isActive } from './dispute.state';
import { DisputeEventType, DomainEvent, ResolutionType } from './disputes.events';
import { InvalidDisputeError, DisputeNotActiveError, DisputeForbiddenError } from './disputes.errors';

export interface DisputeProps {
  id: string; tenantId: string; orderId: string; raisedBy: string; againstUser: string; reasonId: string;
  description: string | null; status: DisputeStatus; sellerRespondBy: Date | null; aiTriage: Record<string, unknown> | null;
  resolutionType: string | null; resolutionAmountMinor: bigint | null; resolutionTxnId: string | null;
  resolvedBy: string | null; resolvedAt: Date | null; slaDueAt: Date | null; createdAt: Date;
}

export class Dispute {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: DisputeProps) {}

  static raise(input: {
    id: string; tenantId: string; orderId: string; raisedBy: string; againstUser: string; reasonId: string;
    description?: string | null; sellerRespondBy?: Date | null; slaDueAt?: Date | null; now?: Date;
  }): Dispute {
    if (input.raisedBy === input.againstUser) throw new InvalidDisputeError('cannot dispute against yourself');
    if (input.description != null && input.description.length > 4000) throw new InvalidDisputeError('description exceeds 4000 chars');
    const d = new Dispute({
      id: input.id, tenantId: input.tenantId, orderId: input.orderId, raisedBy: input.raisedBy, againstUser: input.againstUser,
      reasonId: input.reasonId, description: input.description ?? null, status: 'open', sellerRespondBy: input.sellerRespondBy ?? null,
      aiTriage: null, resolutionType: null, resolutionAmountMinor: null, resolutionTxnId: null, resolvedBy: null, resolvedAt: null,
      slaDueAt: input.slaDueAt ?? null, createdAt: input.now ?? new Date(),
    });
    d.events.push({ type: DisputeEventType.Opened, payload: { disputeId: d.props.id, orderId: d.props.orderId, raisedBy: d.props.raisedBy, againstUser: d.props.againstUser } });
    return d;
  }
  static rehydrate(props: DisputeProps): Dispute { return new Dispute(props); }

  get id() { return this.props.id; }
  get status() { return this.props.status; }
  get orderId() { return this.props.orderId; }
  get raisedBy() { return this.props.raisedBy; }
  get againstUser() { return this.props.againstUser; }
  toProps(): Readonly<DisputeProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  /** The respondent (against_user) files their side. */
  sellerRespond(byUser: string): void {
    if (byUser !== this.props.againstUser) throw new DisputeForbiddenError('only the responding party may respond');
    this.to('seller_responded', DisputeEventType.SellerResponded, {});
  }
  /** Moderator moves the dispute into review / escalation. */
  startReview(): void { this.to('under_review', DisputeEventType.UnderReview, {}); }
  escalate(): void {
    if (!isActive(this.props.status)) throw new DisputeNotActiveError(this.props.status);
    this.to('escalated', DisputeEventType.Escalated, {});
  }

  /** The raiser withdraws while the dispute is still active. */
  withdraw(byUser: string): void {
    if (byUser !== this.props.raisedBy) throw new DisputeForbiddenError('only the raiser may withdraw');
    if (!isActive(this.props.status)) throw new DisputeNotActiveError(this.props.status);
    this.to('withdrawn', DisputeEventType.Withdrawn, {});
  }

  /** Moderator decides. refund_* / replacement → resolved (in the raiser's favour); 'rejected' → rejected
   *  (denied). Either way the decision is announced; orders applies refund/release downstream. */
  resolve(moderatorUserId: string, resolutionType: ResolutionType, resolutionAmountMinor: bigint | null, now: Date = new Date()): void {
    if (!isActive(this.props.status)) throw new DisputeNotActiveError(this.props.status);
    if (resolutionType === 'refund_partial' && (resolutionAmountMinor == null || resolutionAmountMinor <= 0n)) throw new InvalidDisputeError('refund_partial requires a positive amount');
    if (resolutionType === 'refund_full' && resolutionAmountMinor != null && resolutionAmountMinor < 0n) throw new InvalidDisputeError('amount cannot be negative');
    const target: DisputeStatus = resolutionType === 'rejected' ? 'rejected' : 'resolved';
    this.props.resolutionType = resolutionType;
    this.props.resolutionAmountMinor = resolutionType === 'refund_partial' ? resolutionAmountMinor : (resolutionType === 'refund_full' ? resolutionAmountMinor : null);
    this.props.resolvedBy = moderatorUserId;
    this.props.resolvedAt = now;
    this.to(target, DisputeEventType.Resolved, { resolutionType, resolutionAmountMinor: this.props.resolutionAmountMinor?.toString() ?? null, raisedBy: this.props.raisedBy, againstUser: this.props.againstUser });
  }

  private to(status: DisputeStatus, evt: string, payload: Record<string, unknown>): void {
    assertTransition(this.props.status, status);
    this.props.status = status;
    this.events.push({ type: evt, payload: { disputeId: this.props.id, orderId: this.props.orderId, ...payload } });
  }
}
