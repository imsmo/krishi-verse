// modules/payments/domain/payout.entity.ts
// Payout aggregate (money OUT to a bank/UPI account). Pure domain: bigint minor units, status only
// via the state machine. The wallet debit (reserving the funds) is done by the service; this entity
// governs the disbursement lifecycle the gateway (RazorpayX) drives.
import { PayoutStatus, assertTransition } from './payout.state';

export interface PayoutProps {
  id: string; tenantId: string; userId: string | null; bankAccountId: string; purposeId: string;
  referenceType: string | null; referenceId: string | null; amountMinor: bigint; currencyCode: string;
  status: PayoutStatus; priority: number; providerCode: string; gatewayPayoutId: string | null;
  idempotencyKey: string; failureCode: string | null; failureReason: string | null; ledgerTxnId: string | null;
  batchId: string | null; createdAt: Date;
}

export class Payout {
  private constructor(private props: PayoutProps) {}

  static queue(input: {
    id: string; tenantId: string; userId: string | null; bankAccountId: string; purposeId: string;
    referenceType: string | null; referenceId: string | null; amountMinor: bigint; currencyCode: string;
    providerCode: string; idempotencyKey: string; priority?: number; ledgerTxnId: string; now?: Date;
  }): Payout {
    if (input.amountMinor <= 0n) throw new Error('payout amount must be positive');
    return new Payout({
      id: input.id, tenantId: input.tenantId, userId: input.userId, bankAccountId: input.bankAccountId, purposeId: input.purposeId,
      referenceType: input.referenceType, referenceId: input.referenceId, amountMinor: input.amountMinor, currencyCode: input.currencyCode,
      status: 'queued', priority: input.priority ?? 100, providerCode: input.providerCode, gatewayPayoutId: null,
      idempotencyKey: input.idempotencyKey, failureCode: null, failureReason: null, ledgerTxnId: input.ledgerTxnId, batchId: null,
      createdAt: input.now ?? new Date(),
    });
  }
  static rehydrate(props: PayoutProps): Payout { return new Payout(props); }

  get id() { return this.props.id; }
  get status() { return this.props.status; }
  get amountMinor() { return this.props.amountMinor; }
  toProps(): Readonly<PayoutProps> { return Object.freeze({ ...this.props }); }

  startProcessing(gatewayPayoutId: string): void { this.to('processing'); this.props.gatewayPayoutId = gatewayPayoutId; }
  /** Record the gateway id on an already-processing payout (claimed by the execution job). */
  recordGatewayId(gatewayPayoutId: string): void { this.props.gatewayPayoutId = gatewayPayoutId; }
  markSuccess(): void { this.to('success'); }
  markFailed(code: string | null, reason: string | null): void { this.to('failed'); this.props.failureCode = code; this.props.failureReason = reason; }
  reverse(): void { this.to('reversed'); }
  cancel(): void { this.to('cancelled'); }

  private to(status: PayoutStatus): void { assertTransition(this.props.status, status); this.props.status = status; }
}
