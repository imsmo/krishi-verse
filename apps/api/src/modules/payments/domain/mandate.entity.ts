// modules/payments/domain/mandate.entity.ts
// UPI AutoPay mandate aggregate. Pure domain: status transitions ONLY via the state machine (Law 5),
// optimistic-locked by `version`. NO money lives here — it records the standing instruction; the actual
// auto-debit moves funds ONLY through the wallet-service ledger when the PSP confirms a collection
// (execution is a flagged follow-on). The raw VPA is NEVER stored: only a masked form (DPDP minimisation).
import { MandateStatus, assertTransition } from './mandate.state';
import { MandateEventType, DomainEvent } from './payments.events';
import { InvalidVpaError, MandateNotActiveError, MandateAmountExceedsCapError } from './payments.errors';

// handle@psp — letters/digits/dot/hyphen/underscore handle, an @, then the PSP handle.
const VPA_RE = /^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z][a-zA-Z0-9.\-]{1,30}$/;

/** Mask a UPI VPA to "ab***@psp" — keep ≤2 leading chars of the handle, drop the rest, keep the @psp suffix.
 *  Throws InvalidVpaError on a malformed VPA so we never store/echo an unvalidated handle. */
export function maskVpa(raw: string): string {
  const vpa = (raw ?? '').trim();
  if (!VPA_RE.test(vpa)) throw new InvalidVpaError();
  const [handle, psp] = vpa.split('@');
  const head = handle.slice(0, Math.min(2, handle.length));
  return `${head}***@${psp}`;
}

export interface MandateProps {
  id: string; tenantId: string; userId: string;
  providerCode: string; providerMandateRef: string | null;
  vpaMasked: string; purpose: string;
  maxAmountMinor: bigint; currencyCode: string; frequency: string;
  status: MandateStatus; validUntil: Date | null; cancelledReason: string | null;
  version: number; createdAt: Date;
}

export class Mandate {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: MandateProps) {}

  static register(input: {
    id: string; tenantId: string; userId: string; providerCode: string; vpaRaw: string;
    purpose: string; maxAmountMinor: bigint; currencyCode: string; frequency: string;
    validUntil: Date | null; now?: Date;
  }): Mandate {
    if (input.maxAmountMinor <= 0n) throw new InvalidVpaError(); // per-debit cap must be positive (guard reuse)
    const m = new Mandate({
      id: input.id, tenantId: input.tenantId, userId: input.userId, providerCode: input.providerCode,
      providerMandateRef: null, vpaMasked: maskVpa(input.vpaRaw), purpose: input.purpose,
      maxAmountMinor: input.maxAmountMinor, currencyCode: input.currencyCode, frequency: input.frequency,
      status: 'pending', validUntil: input.validUntil, cancelledReason: null, version: 1, createdAt: input.now ?? new Date(),
    });
    m.events.push({ type: MandateEventType.Registered, payload: { mandateId: m.props.id, userId: m.props.userId, purpose: m.props.purpose, maxAmountMinor: m.props.maxAmountMinor.toString() } });
    return m;
  }
  static rehydrate(props: MandateProps): Mandate { return new Mandate(props); }

  get id() { return this.props.id; }
  get status() { return this.props.status; }
  get userId() { return this.props.userId; }
  get tenantId() { return this.props.tenantId; }
  get version() { return this.props.version; }
  get currencyCode() { return this.props.currencyCode; }
  get maxAmountMinor() { return this.props.maxAmountMinor; }
  get providerMandateRef() { return this.props.providerMandateRef; }
  toProps(): Readonly<MandateProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  /** Guard a collection request against this mandate BEFORE any money moves (Law 5 / server sole authority).
   *  Throws if the mandate is not active or the amount exceeds the authorised per-debit cap. Pure — no state change.
   *  On success it records the Executed event; the caller flushes it once the ledger move + row insert commit. */
  assertCollectable(amountMinor: bigint, ctx: { executionId: string; idempotencyKey: string }): void {
    if (this.props.status !== 'active') throw new MandateNotActiveError(this.props.status);
    if (amountMinor <= 0n) throw new MandateAmountExceedsCapError(amountMinor, this.props.maxAmountMinor);
    if (amountMinor > this.props.maxAmountMinor) throw new MandateAmountExceedsCapError(amountMinor, this.props.maxAmountMinor);
    this.events.push({ type: MandateEventType.Executed, payload: {
      mandateId: this.props.id, userId: this.props.userId, purpose: this.props.purpose,
      executionId: ctx.executionId, amountMinor: amountMinor.toString(), currencyCode: this.props.currencyCode,
      idempotencyKey: ctx.idempotencyKey,
    } });
  }

  /** PSP confirmed the standing instruction (provider mandate token attached). Idempotent. */
  activate(providerMandateRef: string): boolean {
    if (this.props.status === 'active') return false;
    assertTransition(this.props.status, 'active');
    this.props.status = 'active'; this.props.providerMandateRef = providerMandateRef;
    this.events.push({ type: MandateEventType.Activated, payload: { mandateId: this.props.id } });
    return true;
  }

  /** User (or system) revokes the mandate. Idempotent: a repeat cancel is a no-op (returns false). */
  cancel(reason: string | null): boolean {
    if (this.props.status === 'cancelled') return false;
    assertTransition(this.props.status, 'cancelled');
    this.props.status = 'cancelled'; this.props.cancelledReason = reason;
    this.events.push({ type: MandateEventType.Cancelled, payload: { mandateId: this.props.id, userId: this.props.userId, purpose: this.props.purpose } });
    return true;
  }
}
