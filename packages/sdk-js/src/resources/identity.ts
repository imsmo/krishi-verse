// @krishi-verse/sdk-js · KYC + bank-account resources (module 1, identity). KYC submission references an uploaded
// media id (the doc image) — raw doc numbers are NEVER sent (only a masked value); review is admin-only (server).
// Bank accounts store a gateway-tokenised vaultRef + last-4/IFSC only — never a raw account number. Both POSTs
// require an Idempotency-Key (Law 3). KYC is gated server-side by the `kyc` flag.
import { HttpClient } from '../http';
import { KycDocument, BankAccount } from '../types';

export class KycResource {
  constructor(private readonly http: HttpClient) {}
  /** Submit a KYC document (docTypeId + uploaded mediaId). Status starts 'pending' (manual review). */
  async submit(input: { docTypeId: string; mediaId: string; roleId?: string; docNoMasked?: string; issuedBy?: string; validFrom?: string; validUntil?: string }, idempotencyKey: string): Promise<{ id: string }> {
    return (await this.http.request<{ id: string }>('POST', 'kyc', { idempotencyKey, body: input })).data;
  }
  /** The caller's KYC documents + statuses (optionally filtered). */
  async list(status?: string, signal?: AbortSignal): Promise<KycDocument[]> {
    return (await this.http.request<KycDocument[]>('GET', 'kyc', { query: { status }, signal })).data;
  }
}

export class BankAccountsResource {
  constructor(private readonly http: HttpClient) {}
  async list(signal?: AbortSignal): Promise<BankAccount[]> {
    return (await this.http.request<BankAccount[]>('GET', 'bank-accounts', { signal })).data;
  }
  /** Add a payout destination. `vaultRef` is the gateway-tokenised fund-account id (raw account/VPA tokenised at
   * the gateway — never sent here in the clear). */
  async add(input: { accountKind: 'bank' | 'upi'; vaultRef: string; upiId?: string; accountLast4?: string; ifsc?: string; holderName?: string; isPrimary?: boolean }, idempotencyKey: string): Promise<BankAccount> {
    return (await this.http.request<BankAccount>('POST', 'bank-accounts', { idempotencyKey, body: input })).data;
  }
}
