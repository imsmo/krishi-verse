// modules/payments/gateway/mandate-gateway.port.ts
// Gateway-agnostic port for UPI-AutoPay standing instructions (money-IN via a recurring mandate).
// Two operations only: (1) confirm — the PSP registers the mandate token after the user approves it in
// their UPI app; (2) collect — the PSP pulls a capped debit from the user's bank on presentation. Adapters
// are resilience-wrapped and selected by provider_code. NO money is moved here — collect() only returns the
// provider's collection reference; the funds land in the wallet ONLY through WalletPort.post (Law 2).
// Until a live UPI-AutoPay PSP + webhook are wired, execution stays behind the `autopay_execution` flag.
export const MANDATE_GATEWAY = Symbol('MANDATE_GATEWAY');

export interface ConfirmMandateInput {
  mandateId: string;
  vpaMasked: string;               // already-masked handle (never a raw VPA — DPDP minimisation)
  maxAmountMinor: bigint;
  currencyCode: string;
  frequency: string;
}
export interface ConfirmMandateResult { providerMandateRef: string; }

export interface CollectInput {
  mandateId: string;
  providerMandateRef: string;      // the standing-instruction token from confirm()
  amountMinor: bigint;             // ≤ mandate cap (the domain has already asserted this)
  currencyCode: string;
  idempotencyKey: string;          // one collection per key end-to-end (Law 3)
}
export interface CollectResult { providerPaymentRef: string; }

export interface MandateGateway {
  readonly providerCode: string;
  /** Register the standing instruction with the PSP; returns the mandate token. Resilience-wrapped. */
  confirmMandate(input: ConfirmMandateInput): Promise<ConfirmMandateResult>;
  /** Present a capped debit to the PSP; returns the collection reference. Resilience-wrapped, idempotent. */
  collect(input: CollectInput): Promise<CollectResult>;
}
