// modules/memberships/policies/memberships.policies.ts · permission keys (DB-backed RBAC, Law 6).
import { RequestContext } from '../../../core/tenancy-context/request-context';
// Managing tiers (create/pause) + the tenant-wide membership list need membership.manage. Browsing tiers
// and subscribing/cancelling/renewing one's OWN membership is any authenticated tenant user.
export const MembershipPermissions = { Manage: 'membership.manage' } as const;
export function canManageMemberships(ctx: RequestContext): boolean {
  return ctx.permissions.has('membership.manage') || ctx.permissions.has('*');
}
