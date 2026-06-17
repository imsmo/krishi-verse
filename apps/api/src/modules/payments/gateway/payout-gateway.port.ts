// modules/payments/gateway/payout-gateway.port.ts
// Gateway-agnostic port for money-OUT disbursements (RazorpayX, …). Adapters are resilience-wrapped.
// createPayout returns a DEFINITIVE outcome — never throws for a business rejection (so we can
// safely reverse the reservation); it only throws InfraError for ambiguous transport failures
// (timeout/5xx), in which case the caller leaves the payout QUEUED and retries (idempotent on the
// payout's idempotency key) — we must NEVER auto-reverse an ambiguous disbursement (double-pay risk).
export const PAYOUT_GATEWAY = Symbol('PAYOUT_GATEWAY');

export interface CreatePayoutInput {
  amountMinor: bigint;
  currencyCode: string;
  fundAccountRef: string;      // gateway fund-account/vault token (bank_accounts.vault_ref) — never raw bank details
  idempotencyKey: string;      // = the payout's idempotency key; the PSP dedups on it
  purpose?: string;
}

export interface CreatePayoutResult {
  gatewayPayoutId: string;
  /** 'success' = settled synchronously (sandbox/instant); 'processing' = async, a webhook confirms;
   *  'failed' = DEFINITIVE rejection (e.g. invalid account) → safe to reverse the reservation. */
  status: 'success' | 'processing' | 'failed';
  failureCode?: string;
  failureReason?: string;
}

export interface PayoutGateway {
  readonly providerCode: string;
  createPayout(input: CreatePayoutInput): Promise<CreatePayoutResult>;
}
