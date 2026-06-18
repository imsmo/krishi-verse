// modules/disputes/policies/disputes.policies.ts · permission keys (DB-backed RBAC, Law 6).
import { RequestContext } from '../../../core/tenancy-context/request-context';
// Raising a dispute needs dispute.raise (buyer/seller roles) AND eligibility (enforced in the service).
// Moderation (review/escalate/resolve) needs dispute.resolve. Party-vs-party authority is per-row.
export const DisputePermissions = { Raise: 'dispute.raise', Resolve: 'dispute.resolve' } as const;
export function canModerateDispute(ctx: RequestContext): boolean {
  return ctx.permissions.has('dispute.resolve') || ctx.permissions.has('*');
}
