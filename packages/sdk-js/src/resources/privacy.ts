// @krishi-verse/sdk-js · DPDP privacy resource (P-23 data-download / account-delete / change-phone). ASSUMED
// CONTRACTS: the only identity privacy surface live today is `consents` (list/grant) — there is NO data-export,
// account-deletion, or change-phone endpoint yet. We wire the real call shapes we expect (idempotent — Law 3) so
// the screens degrade honestly until the endpoints land (the app NEVER fabricates an export file or "deletes" the
// account client-side; the server is the data controller — Law 11). Phone change is OTP-verified server-side.
import { HttpClient } from '../http';
import { PrivacyRequest } from '../types';

export class PrivacyResource {
  constructor(private readonly http: HttpClient) {}
  /** Request a DPDP data export (the server compiles + emails/links it). Idempotent. */
  async requestDataExport(idempotencyKey: string): Promise<PrivacyRequest> {
    return (await this.http.request<PrivacyRequest>('POST', 'privacy/export-requests', { idempotencyKey, body: {} })).data;
  }
  /** Request account deletion (DPDP erasure; server runs retention/anti-fraud holds then erases). Idempotent. */
  async requestAccountDeletion(input: { reason?: string }, idempotencyKey: string): Promise<PrivacyRequest> {
    return (await this.http.request<PrivacyRequest>('POST', 'privacy/deletion-requests', { idempotencyKey, body: input })).data;
  }
  /** The caller's own data-subject requests (status tracking). */
  async myRequests(signal?: AbortSignal): Promise<PrivacyRequest[]> {
    return (await this.http.request<PrivacyRequest[]>('GET', 'privacy/requests', { signal })).data;
  }
  /** Start a phone-number change — the server sends an OTP to the NEW number (enumeration-safe). Idempotent. */
  async startPhoneChange(newPhone: string, idempotencyKey: string): Promise<{ ok: boolean }> {
    return (await this.http.request<{ ok: boolean }>('POST', 'auth/change-phone/start', { idempotencyKey, body: { newPhone } })).data;
  }
  /** Confirm the phone change with the OTP sent to the new number. */
  async confirmPhoneChange(newPhone: string, code: string): Promise<{ ok: boolean }> {
    return (await this.http.request<{ ok: boolean }>('POST', 'auth/change-phone/confirm', { body: { newPhone, code } })).data;
  }
}
