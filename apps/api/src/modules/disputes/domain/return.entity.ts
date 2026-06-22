// modules/disputes/domain/return.entity.ts
// Return/RMA aggregate — a buyer asks to send a delivered order back; the seller/moderator approves,
// goods travel back, and a refund is issued once received. Pure domain: status transitions ONLY via the
// state machine (Law 5); NO money moves here — the refund is applied downstream (orders/payments) on the
// return_refunded event. No version column (add_std_columns) → the service serializes mutations with
// SELECT … FOR UPDATE.
import { ReturnStatus, assertTransition } from './return.state';
import { ReturnEventType, DomainEvent } from './disputes.events';

export interface ReturnProps {
  id: string; tenantId: string; orderId: string; disputeId: string | null;
  status: ReturnStatus; reasonId: string | null; refundTxnId: string | null; createdAt: Date;
}

export class Return {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: ReturnProps) {}

  static request(input: { id: string; tenantId: string; orderId: string; disputeId?: string | null; reasonId?: string | null; now?: Date }): Return {
    const r = new Return({
      id: input.id, tenantId: input.tenantId, orderId: input.orderId, disputeId: input.disputeId ?? null,
      status: 'requested', reasonId: input.reasonId ?? null, refundTxnId: null, createdAt: input.now ?? new Date(),
    });
    r.events.push({ type: ReturnEventType.Requested, payload: { returnId: r.props.id, orderId: r.props.orderId } });
    return r;
  }
  static rehydrate(props: ReturnProps): Return { return new Return(props); }

  get id() { return this.props.id; }
  get status() { return this.props.status; }
  get orderId() { return this.props.orderId; }
  toProps(): Readonly<ReturnProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  approve(): void { this.to('approved', ReturnEventType.Approved, {}); }
  reject(): void { this.to('rejected', ReturnEventType.Rejected, {}); }
  ship(): void { this.to('in_transit', ReturnEventType.InTransit, {}); }   // buyer sends the goods back
  receive(): void { this.to('received', ReturnEventType.Received, {}); }   // seller/moderator confirms arrival

  /** Goods received → issue the refund. The ledger reversal txn id (if any) is stamped downstream;
   *  callers may pass it so the event carries it, but the entity does NOT move money. */
  refund(refundTxnId?: string | null): void {
    this.to('refunded', ReturnEventType.Refunded, { refundTxnId: refundTxnId ?? null });
    if (refundTxnId) this.props.refundTxnId = refundTxnId;
  }

  private to(status: ReturnStatus, evt: string, payload: Record<string, unknown>): void {
    assertTransition(this.props.status, status);
    this.props.status = status;
    this.events.push({ type: evt, payload: { returnId: this.props.id, orderId: this.props.orderId, ...payload } });
  }
}
