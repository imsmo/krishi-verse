// modules/offers/policies/offers.policies.ts · permission keys (DB-backed RBAC, Law 6).
import { RequestContext } from '../../../core/tenancy-context/request-context';
// Making an offer requires offer.create (granted to buyer roles in db/seeds/core/0004). Responding
// (counter/accept/reject) is authorized per-party in the service: the buyer is buyer_user_id; the
// seller is the listing's seller (resolved via ListingService — Law 11).
export const OfferPermissions = { Create: 'offer.create' } as const;
/** Tenant-admin moderation (act on the seller's behalf, view a listing's offers). NOT god-mode. */
export function canModerateOffer(ctx: RequestContext): boolean {
  return ctx.permissions.has('listing.moderate') || ctx.permissions.has('dispute.resolve') || ctx.permissions.has('*');
}
