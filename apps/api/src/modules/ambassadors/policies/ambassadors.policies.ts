// modules/ambassadors/policies/ambassadors.policies.ts · permission keys (DB-backed RBAC, Law 6; seeded 0004).
//   ambassador.manage — admin: enroll/suspend ambassadors, activate referrals, run commission payouts (the
//   money gate). Being an ambassador is NOT self-grant (Law 11). Creating/sharing a referral code + viewing
//   one's OWN referrals/earnings needs only authentication (ownership = caller's userId; no IDOR).
import { RequestContext } from '../../../core/tenancy-context/request-context';
export const AmbassadorsPermissions = { Manage: 'ambassador.manage' } as const;
export const canManageAmbassadors = (ctx: RequestContext) => ctx.permissions.has('ambassador.manage') || ctx.permissions.has('*');
