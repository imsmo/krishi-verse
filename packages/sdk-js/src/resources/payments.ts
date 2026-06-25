// @krishi-verse/sdk-js · payments + payouts resources (module 4). createIntent returns a gateway order to hand to
// the gateway SDK (Razorpay) on the client; the actual capture is verified SERVER-SIDE via the signed webhook —
// the client only polls status. Both money-moving POSTs require an Idempotency-Key (Law 3). Money is bigint
// minor-unit strings (Law 2). Gated server-side by the `online_payments` flag.
import { HttpClient } from '../http';
import { PaymentIntent, PaymentSummary, PayoutSummary, WalletBalance, WalletLedgerEntry, WalletInsights, AutopayMandate, InvoiceSummary, InvoiceDownload, Page } from '../types';

/** Buyer-facing GST trade invoices for orders. Read-only + ownership-gated server-side (the order's buyer/seller
 *  or a finance moderator — a foreign order is 404, never enumerable). Hangs off `payments.invoices`. */
export class InvoicesResource {
  constructor(private readonly http: HttpClient) {}
  /** The invoice record for an order (totals + GST split). 404 if none / not the caller's order. */
  async getByOrder(orderId: string, signal?: AbortSignal): Promise<InvoiceSummary> {
    return (await this.http.request<InvoiceSummary>('GET', `invoices/order/${encodeURIComponent(orderId)}`, { signal })).data;
  }
  /** A short-lived presigned PDF download URL for the order's invoice. Throws if the PDF isn't ready yet
   *  (INVOICE_PDF_NOT_READY, retryable) or the order has no invoice (404). */
  async downloadUrl(orderId: string, signal?: AbortSignal): Promise<InvoiceDownload> {
    return (await this.http.request<InvoiceDownload>('GET', `invoices/order/${encodeURIComponent(orderId)}/download`, { signal })).data;
  }
}

export class PaymentsResource {
  /** GST trade-invoice sub-resource: `client.payments.invoices.getByOrder(...) / .downloadUrl(...)`. */
  readonly invoices: InvoicesResource;
  constructor(private readonly http: HttpClient) { this.invoices = new InvoicesResource(http); }

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
  /** The caller's OWN earnings (credits) aggregated by month + txn type over a bounded window (defaults ~12mo). */
  async earnings(opts: { from?: string; to?: string; currency?: string } = {}, signal?: AbortSignal): Promise<WalletInsights> {
    return (await this.http.request<WalletInsights>('GET', 'wallet/earnings', { query: { from: opts.from, to: opts.to, currency: opts.currency ?? 'INR' }, signal })).data;
  }
  /** The caller's OWN spending (debits, positive magnitudes) aggregated by month + txn type over a bounded window. */
  async spendingInsights(opts: { from?: string; to?: string; currency?: string } = {}, signal?: AbortSignal): Promise<WalletInsights> {
    return (await this.http.request<WalletInsights>('GET', 'wallet/spending-insights', { query: { from: opts.from, to: opts.to, currency: opts.currency ?? 'INR' }, signal })).data;
  }
}

// UPI AutoPay mandates (standing instructions). Always the AUTHENTICATED caller's OWN mandates (no userId param,
// zero IDOR). Registering needs an Idempotency-Key (Law 3). NO money moves on these calls — the raw VPA is masked
// server-side. Gated server-side by the `online_payments` flag.
export class AutopayResource {
  constructor(private readonly http: HttpClient) {}
  /** Register a pending UPI autopay mandate (one live mandate per purpose). vpa is "handle@psp"; never logged. */
  async register(input: { vpa: string; purpose: 'membership' | 'loan_emi' | 'general'; maxAmountMinor: string; currencyCode?: string; frequency?: 'as_presented' | 'daily' | 'weekly' | 'monthly'; validUntil?: string }, idempotencyKey: string): Promise<AutopayMandate> {
    return (await this.http.request<AutopayMandate>('POST', 'wallet/autopay', { idempotencyKey, body: input })).data;
  }
  /** The caller's own autopay mandates, keyset-paginated. */
  async list(cursor?: string, limit = 20, signal?: AbortSignal): Promise<Page<AutopayMandate>> {
    const r = await this.http.request<AutopayMandate[]>('GET', 'wallet/autopay', { query: { cursor, limit }, signal });
    return { items: r.data, nextCursor: (r.meta?.nextCursor as string | null) ?? null };
  }
  async get(id: string, signal?: AbortSignal): Promise<AutopayMandate> {
    return (await this.http.request<AutopayMandate>('GET', `wallet/autopay/${encodeURIComponent(id)}`, { signal })).data;
  }
  /** Cancel (revoke) a mandate the caller owns. */
  async cancel(id: string, reason?: string): Promise<AutopayMandate> {
    return (await this.http.request<AutopayMandate>('DELETE', `wallet/autopay/${encodeURIComponent(id)}`, { body: reason ? { reason } : {} })).data;
  }
}
