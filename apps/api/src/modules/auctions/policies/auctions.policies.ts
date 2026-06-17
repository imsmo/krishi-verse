// modules/auctions/policies/auctions.policies.ts · permission keys (DB-backed RBAC, Law 6).
import { RequestContext } from '../../../core/tenancy-context/request-context';
export const AuctionPermissions = { Create: 'auction.create', Bid: 'auction.bid' } as const;
/** Tenant-admin moderation (force-cancel, approve on the seller's behalf). NOT god-mode. */
export function canModerateAuction(ctx: RequestContext): boolean {
  return ctx.permissions.has('listing.moderate') || ctx.permissions.has('dispute.resolve') || ctx.permissions.has('*');
}
