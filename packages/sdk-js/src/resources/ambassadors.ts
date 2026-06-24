// @krishi-verse/sdk-js · ambassadors resource (module 7 — village acquisition agents). Self-service surface for an
// ambassador: their OWN profile + earnings (server resolves the caller — no client id, no IDOR), the commission
// plan catalogue, and the REFERRAL engine (create a code, claim a code, list own referrals). Attribution is the
// real, server-recorded mechanism: an ambassador creates a code → the referred farmer self-signs-up and claims it
// → activation accrues commission SERVER-SIDE. createReferral carries an Idempotency-Key (Law 3). Money is bigint
// minor strings (Law 2). The app never enrolls/activates/pays out (those are ambassador.manage / back-office —
// Law 11). Gated server-side by the `ambassadors` flag.
import { HttpClient } from '../http';
import { AmbassadorProfile, Referral, AmbassadorEarning, CommissionPlan, AmbassadorVisit, AmbassadorTarget, LeaderboardEntry, AssistedOnboardingResult, Page } from '../types';

/** Ambassador-assisted farmer onboarding (the farmer is created on-behalf; DPDP consent is mandatory). */
export interface AssistedOnboardingInput {
  phone: string; fullName?: string; languageCode?: string; countryCode?: string; regionId?: string;
  consents: { purposeCode: string; granted: boolean }[];
}

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

  // --- field-ops (API-W9) ---
  /** Onboard a farmer ON-BEHALF (the caller must be an active ambassador; DPDP consent is required). The farmer
   * account + consent + a 'signed_up' attribution referral are created server-side; the onboarding COMMISSION
   * accrues only when an admin activates the referral. Idempotent (Law 3). */
  async assistedOnboard(input: AssistedOnboardingInput, idempotencyKey: string): Promise<AssistedOnboardingResult> {
    return (await this.http.request<AssistedOnboardingResult>('POST', 'ambassadors/assisted-onboarding', { idempotencyKey, body: input })).data;
  }
  /** Log a geo-stamped field visit the caller-ambassador made. */
  async logVisit(input: { purpose?: string; visitedUserId?: string; notes?: string; lat?: number; lng?: number; regionId?: string }): Promise<AmbassadorVisit> {
    return (await this.http.request<AmbassadorVisit>('POST', 'ambassadors/visits', { body: input })).data;
  }
  /** The caller-ambassador's own visit timeline (keyset). */
  async listVisits(params: { cursor?: string; limit?: number } = {}, signal?: AbortSignal): Promise<Page<AmbassadorVisit>> {
    const r = await this.http.request<AmbassadorVisit[]>('GET', 'ambassadors/visits', { query: { cursor: params.cursor, limit: params.limit ?? 50 }, signal });
    return { items: r.data, nextCursor: (r.meta?.nextCursor as string | null) ?? null };
  }
  /** The tenant leaderboard (ranked by commission earned, optional date window). */
  async leaderboard(params: { periodStart?: string; periodEnd?: string; limit?: number } = {}, signal?: AbortSignal): Promise<LeaderboardEntry[]> {
    return (await this.http.request<LeaderboardEntry[]>('GET', 'ambassadors/leaderboard', { query: { periodStart: params.periodStart, periodEnd: params.periodEnd, limit: params.limit ?? 20 }, signal })).data;
  }
  /** The caller-ambassador's own period targets. */
  async myTargets(limit = 50, signal?: AbortSignal): Promise<AmbassadorTarget[]> {
    return (await this.http.request<AmbassadorTarget[]>('GET', 'ambassadors/targets/me', { query: { limit }, signal })).data;
  }
}
