// @krishi-verse/sdk-js · ambassadors resource (module 7 — village acquisition agents). Self-service surface for an
// ambassador: their OWN profile + earnings (server resolves the caller — no client id, no IDOR), the commission
// plan catalogue, and the REFERRAL engine (create a code, claim a code, list own referrals). Attribution is the
// real, server-recorded mechanism: an ambassador creates a code → the referred farmer self-signs-up and claims it
// → activation accrues commission SERVER-SIDE. createReferral carries an Idempotency-Key (Law 3). Money is bigint
// minor strings (Law 2). The app never enrolls/activates/pays out (those are ambassador.manage / back-office —
// Law 11). Gated server-side by the `ambassadors` flag.
import { HttpClient } from '../http';
import { AmbassadorProfile, Referral, AmbassadorEarning, CommissionPlan, Page } from '../types';

export class AmbassadorsResource {
  constructor(private readonly http: HttpClient) {}

  /** The caller's own ambassador profile (404 if not an ambassador). */
  async myProfile(signal?: AbortSignal): Promise<AmbassadorProfile> {
    return (await this.http.request<AmbassadorProfile>('GET', 'ambassadors/me', { signal })).data;
  }
  /** The caller's own accrued earnings (keyset). `unpaidOnly` filters to not-yet-paid commission. */
  async myEarnings(params: { unpaidOnly?: boolean; cursor?: string; limit?: number } = {}, signal?: AbortSignal): Promise<Page<AmbassadorEarning>> {
    const r = await this.http.request<AmbassadorEarning[]>('GET', 'ambassadors/me/earnings', { query: { unpaidOnly: params.unpaidOnly, cursor: params.cursor, limit: params.limit ?? 50 }, signal });
    return { items: r.data, nextCursor: (r.meta?.nextCursor as string | null) ?? null };
  }
  /** The commission plan catalogue (read-only). */
  async plans(signal?: AbortSignal): Promise<CommissionPlan[]> {
    return (await this.http.request<CommissionPlan[]>('GET', 'ambassadors/plans', { signal })).data;
  }

  // --- referrals (the caller's own) ---
  /** Create a referral code to share with a farmer (4–20 uppercase alphanumerics). Idempotent (Law 3). */
  async createReferral(code: string, idempotencyKey: string): Promise<Referral> {
    return (await this.http.request<Referral>('POST', 'ambassadors/referrals', { idempotencyKey, body: { code } })).data;
  }
  /** Claim a referral code (the referred user calls this after sign-up — attribution recorded server-side). */
  async claimReferral(code: string): Promise<Referral> {
    return (await this.http.request<Referral>('POST', 'ambassadors/referrals/claim', { body: { code } })).data;
  }
  /** List the caller's referrals (optionally by status). Keyset. */
  async listReferrals(params: { status?: string; cursor?: string; limit?: number } = {}, signal?: AbortSignal): Promise<Page<Referral>> {
    const r = await this.http.request<Referral[]>('GET', 'ambassadors/referrals', { query: { status: params.status, cursor: params.cursor, limit: params.limit ?? 50 }, signal });
    return { items: r.data, nextCursor: (r.meta?.nextCursor as string | null) ?? null };
  }
}
