// modules/requirements/policies/requirements.policies.ts · permission keys (DB-backed RBAC, Law 6).
import { RequestContext } from '../../../core/tenancy-context/request-context';
// Posting a requirement needs requirement.post (buyer roles); quoting needs requirement.quote (seller
// roles). Buyer-vs-seller authority on a specific requirement/quote is enforced per-row in the service.
export const RequirementPermissions = { Post: 'requirement.post', Quote: 'requirement.quote' } as const;
/** Tenant-admin moderation (close a requirement, act on a quote). NOT god-mode. */
export function canModerateRequirement(ctx: RequestContext): boolean {
  return ctx.permissions.has('listing.moderate') || ctx.permissions.has('dispute.resolve') || ctx.permissions.has('*');
}
