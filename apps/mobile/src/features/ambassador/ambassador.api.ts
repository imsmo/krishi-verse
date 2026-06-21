// apps/mobile/src/features/ambassador/ambassador.api.ts · data layer for the ambassador vertical (P-15). Keeps
// screens thin (guide §3). Reads degrade-never-die (null/empty). createReferral is idempotent (Law 3) and throws
// so the screen shows the precise outcome (409 duplicate code / 403 not-allowed). Money is bigint minor strings
// (Law 2); the app never moves money — commission accrues + pays out SERVER-SIDE (Law 11). The ambassador only
// ever sees/acts on their OWN profile/earnings/referrals (server resolves the caller — no IDOR).
import type { AmbassadorProfile, Referral, AmbassadorEarning } from '@krishi-verse/sdk-js';
import { apiClient } from '../../core/api/client';
import { newId } from '../../core/util/ids';

export interface ReferralsPage { items: Referral[]; nextCursor: string | null }
export interface EarningsPage { items: AmbassadorEarning[]; nextCursor: string | null }

/** The caller's own ambassador profile, or null if not an ambassador / unavailable. */
export async function myProfile(): Promise<AmbassadorProfile | null> {
  try { return await apiClient().ambassadors.myProfile(); } catch { return null; }
}
/** The caller's referrals (optionally by status). Degrades to an empty page. */
export async function listReferrals(status?: string, cursor?: string): Promise<ReferralsPage> {
  try { return await apiClient().ambassadors.listReferrals({ status, cursor }); } catch { return { items: [], nextCursor: null }; }
}
/** The caller's earnings. Degrades to an empty page. */
export async function myEarnings(unpaidOnly?: boolean, cursor?: string): Promise<EarningsPage> {
  try { return await apiClient().ambassadors.myEarnings({ unpaidOnly, cursor }); } catch { return { items: [], nextCursor: null }; }
}

/** Create a referral code to share with a farmer. REAL + idempotent (Law 3). Throws on a real error (409 the code
 * is taken / 403 not allowed) so the screen can show a precise message. */
export function createReferral(code: string): Promise<Referral> {
  return apiClient().ambassadors.createReferral(code, newId());
}
