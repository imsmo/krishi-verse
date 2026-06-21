// @krishi-verse/sdk-js · KYC + bank-account resources (module 1, identity). KYC submission references an uploaded
// media id (the doc image) — raw doc numbers are NEVER sent (only a masked value); review is admin-only (server).
// Bank accounts store a gateway-tokenised vaultRef + last-4/IFSC only — never a raw account number. Both POSTs
// require an Idempotency-Key (Law 3). KYC is gated server-side by the `kyc` flag.
import { HttpClient } from '../http';
import { KycDocument, BankAccount, Address } from '../types';

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

/** The buyer's delivery address book (owner-scoped server-side). Used by checkout. Contact phone/name are PII —
 * stored server-side, shown back to the owner only. */
export class AddressesResource {
  constructor(private readonly http: HttpClient) {}
  async list(signal?: AbortSignal): Promise<Address[]> {
    return (await this.http.request<Address[]>('GET', 'addresses', { signal })).data;
  }
  async create(input: { line1: string; line2?: string; village?: string; regionId?: string; pincode?: string; countryCode?: string; contactName?: string; contactPhone?: string; lat?: number; lng?: number; labelId?: string; isDefault?: boolean }): Promise<Address> {
    return (await this.http.request<Address>('POST', 'addresses', { body: input })).data;
  }
  async update(id: string, patch: Partial<{ line1: string; line2: string; village: string; pincode: string; contactName: string; contactPhone: string; isDefault: boolean }>): Promise<Address> {
    return (await this.http.request<Address>('PATCH', `addresses/${encodeURIComponent(id)}`, { body: patch })).data;
  }
  async remove(id: string): Promise<{ ok: boolean }> {
    return (await this.http.request<{ ok: boolean }>('DELETE', `addresses/${encodeURIComponent(id)}`)).data;
  }
}
