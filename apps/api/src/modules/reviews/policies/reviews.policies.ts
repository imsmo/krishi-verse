// modules/reviews/policies/reviews.policies.ts · permission keys (DB-backed RBAC, Law 6).
import { RequestContext } from '../../../core/tenancy-context/request-context';
// Posting a review needs review.create (buyer/seller roles) AND verified-purchase eligibility (enforced
// in the service). Moderation needs review.moderate. Author/target authority is enforced per-row.
export const ReviewPermissions = { Create: 'review.create', Moderate: 'review.moderate' } as const;
export function canModerateReview(ctx: RequestContext): boolean {
  return ctx.permissions.has('review.moderate') || ctx.permissions.has('listing.moderate') || ctx.permissions.has('*');
}
