// modules/payments/domain/payment.entity.ts
// Payment aggregate (money IN). Pure domain: amounts in bigint minor units, status transitions
// ONLY via the state machine (Law 5), optimistic-locked by `version` (from add_std_columns).
// The actual ledger movement is performed by the wallet client in the service — the entity just
// governs the legal lifecycle and records what to emit.
import { PaymentStatus, assertTransition } from './payment.state';
import { PaymentEventType, DomainEvent } from './payments.events';
import { RefundExceedsPaymentError } from './payments.errors';

export interface PaymentProps {
  id: string; tenantId: string; userId: string; purposeId: string;
  referenceType: string | null; referenceId: string | null;
  amountMinor: bigint; refundedMinor: bigint; currencyCode: string;
  status: PaymentStatus; providerCode: string; gatewayOrderId: string | null; gatewayPaymentId: string | null;
  method: string | null; idempotencyKey: string; failureCode: string | null; failureReason: string | null;
  ledgerTxnId: string | null; version: number; createdAt: Date;
}

export class Payment {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: PaymentProps) {}

  static initiate(input: {
    id: string; tenantId: string; userId: string; purposeId: string; referenceType: string | null; referenceId: string | null;
    amountMinor: bigint; currencyCode: string; providerCode: string; idempotencyKey: string; now?: Date;
  }): Payment {
    if (input.amountMinor <= 0n) throw new RefundExceedsPaymentError(); // amount must be positive (reuse guard family)
    const p = new Payment({
      id: input.id, tenantId: input.tenantId, userId: input.userId, purposeId: input.purposeId,
      referenceType: input.referenceType, referenceId: input.referenceId, amountMinor: input.amountMinor, refundedMinor: 0n,
      currencyCode: input.currencyCode, status: 'initiated', providerCode: input.providerCode, gatewayOrderId: null,
      gatewayPaymentId: null, method: null, idempotencyKey: input.idempotencyKey, failureCode: null, failureReason: null,
      ledgerTxnId: null, version: 1, createdAt: input.now ?? new Date(),
    });
    p.events.push({ type: PaymentEventType.Initiated, payload: { paymentId: p.props.id, amountMinor: p.props.amountMinor.toString() } });
    return p;
  }
  static rehydrate(props: PaymentProps): Payment { return new Payment(props); }

  get id() { return this.props.id; }
  get status() { return this.props.status; }
  get amountMinor() { return this.props.amountMinor; }
  get currencyCode() { return this.props.currencyCode; }
  get refundableMinor() { return this.props.amountMinor - this.props.refundedMinor; }
  get userId() { return this.props.userId; }
  get tenantId() { return this.props.tenantId; }
  toProps(): Readonly<PaymentProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  attachGatewayOrder(gatewayOrderId: string): void { this.props.gatewayOrderId = gatewayOrderId; }

  /** Gateway captured the money. Idempotent: a repeat capture is a no-op (returns false). */
  markCaptured(gatewayPaymentId: string, method: string | null, ledgerTxnId: string): boolean {
    if (this.props.status === 'success') return false;
    assertTransition(this.props.status, 'success');
    this.props.status = 'success';
    this.props.gatewayPaymentId = gatewayPaymentId;
    this.props.method = method;
    this.props.ledgerTxnId = ledgerTxnId;
    this.events.push({ type: PaymentEventType.Succeeded, payload: { paymentId: this.props.id, amountMinor: this.props.amountMinor.toString(), referenceType: this.props.referenceType, referenceId: this.props.referenceId } });
    return true;
  }

  markFailed(code: string | null, reason: string | null): boolean {
    if (this.props.status === 'failed') return false;
    assertTransition(this.props.status, 'failed');
    this.props.status = 'failed'; this.props.failureCode = code; this.props.failureReason = reason;
    this.events.push({ type: PaymentEventType.Failed, payload: { paymentId: this.props.id, code } });
    return true;
  }

  /** Record a refund of `amountMinor`; full vs partial decided by remaining balance. */
  refund(amountMinor: bigint, ledgerTxnId: string): void {
    if (amountMinor <= 0n || amountMinor > this.refundableMinor) throw new RefundExceedsPaymentError();
    this.props.refundedMinor += amountMinor;
    const next: PaymentStatus = this.props.refundedMinor >= this.props.amountMinor ? 'refunded' : 'partially_refunded';
    assertTransition(this.props.status, next);
    this.props.status = next;
    this.props.ledgerTxnId = ledgerTxnId;
    this.events.push({ type: PaymentEventType.Refunded, payload: { paymentId: this.props.id, refundedMinor: amountMinor.toString(), totalRefundedMinor: this.props.refundedMinor.toString(), fully: next === 'refunded' } });
  }
}
