// @krishi-verse/sdk-js · payments + payouts resources (module 4). createIntent returns a gateway order to hand to
// the gateway SDK (Razorpay) on the client; the actual capture is verified SERVER-SIDE via the signed webhook —
// the client only polls status. Both money-moving POSTs require an Idempotency-Key (Law 3). Money is bigint
// minor-unit strings (Law 2). Gated server-side by the `online_payments` flag.
import { HttpClient } from '../http';
import { PaymentIntent, PaymentSummary, PayoutSummary, WalletBalance, WalletLedgerEntry, Page } from '../types';

export class PaymentsResource {
  constructor(private readonly http: HttpClient) {}

  /** Create a payment intent (e.g. purpose 'wallet_recharge'). Returns the gateway order id to open checkout. */
  async createIntent(input: { purpose: string; amountMinor: string; currencyCode?: string; referenceType?: string; referenceId?: string }, idempotencyKey: string): Promise<PaymentIntent> {
    return (await this.http.request<PaymentIntent>('POST', 'payments', { idempotencyKey, body: input })).data;
  }
  /** Poll a payment's status (authoritative server state). */
  async get(id: string, signal?: AbortSignal): Promise<PaymentSummary> {
    return (await this.http.request<PaymentSummary>('GET', `payments/${encodeURIComponent(id)}`, { signal })).data;
  }
  async list(cursor?: string, limit = 20, signal?: AbortSignal): Promise<Page<PaymentSummary>> {
    const r = await this.http.request<PaymentSummary[]>('GET', 'payments', { query: { cursor, limit }, signal });
    return { items: r.data, nextCursor: (r.meta?.nextCursor as string | null) ?? null };
  }
}

export class PayoutsResource {
  constructor(private readonly http: HttpClient) {}
  /** Request a withdrawal from the caller's wallet to a tokenised bank account (ownership enforced server-side). */
  async request(input: { amountMinor: string; bankAccountId: string; purpose?: string; currencyCode?: string }, idempotencyKey: string): Promise<PayoutSummary> {
    return (await this.http.request<PayoutSummary>('POST', 'payouts', { idempotencyKey, body: input })).data;
  }
  async get(id: string, signal?: AbortSignal): Promise<PayoutSummary> {
    return (await this.http.request<PayoutSummary>('GET', `payouts/${encodeURIComponent(id)}`, { signal })).data;
  }
  async list(cursor?: string, limit = 20, signal?: AbortSignal): Promise<Page<PayoutSummary>> {
    const r = await this.http.request<PayoutSummary[]>('GET', 'payouts', { query: { cursor, limit }, signal });
    return { items: r.data, nextCursor: (r.meta?.nextCursor as string | null) ?? null };
  }
}

// Read-only projection of the wallet-service double-entry ledger (the figures the wallet UI shows). Always the
// AUTHENTICATED caller's OWN wallet (server re-resolves the subject from the token — no userId param, zero IDOR).
// Money is bigint minor-unit strings (Law 2); this resource NEVER moves money.
export class WalletResource {
  constructor(private readonly http: HttpClient) {}
  /** The caller's reconciled balance (available + held), server-truth. */
  async balance(currency = 'INR', signal?: AbortSignal): Promise<WalletBalance> {
    return (await this.http.request<WalletBalance>('GET', 'wallet/balance', { query: { currency }, signal })).data;
  }
  /** The caller's wallet ledger (per-entry statement), keyset-paginated. */
  async ledger(cursor?: string, limit = 20, currency = 'INR', signal?: AbortSignal): Promise<Page<WalletLedgerEntry>> {
    const r = await this.http.request<WalletLedgerEntry[]>('GET', 'wallet/ledger', { query: { cursor, limit, currency }, signal });
    return { items: r.data, nextCursor: (r.meta?.nextCursor as string | null) ?? null };
  }
}
