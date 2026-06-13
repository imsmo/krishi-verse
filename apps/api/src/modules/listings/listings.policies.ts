// modules/listings/listings.policies.ts
// Permission constants + ownership guard logic for the listings surface. Permissions
// are stored in the DB (dynamic RBAC, Law 9) — these are the string keys the seed
// pack grants to roles. The guard resolves the caller's effective permission set
// (role grants + per-user overrides) from RequestContext.
export const ListingPermissions = {
  Create: 'listing.create',
  Update: 'listing.update',
  Publish: 'listing.publish',
  Moderate: 'listing.moderate',     // tenant admin / support: reject, force-pause
  ViewAny: 'listing.view_any',      // see other sellers' listings within tenant
  Boost: 'listing.boost',
  GroupLotManage: 'group_lot.manage',
} as const;
export type ListingPermission = typeof ListingPermissions[keyof typeof ListingPermissions];

import { RequestContext } from '../../core/tenancy-context/request-context';

/** True if the caller holds the permission OR owns the resource. */
export function canMutateListing(ctx: RequestContext, listingSellerUserId: string, perm: ListingPermission): boolean {
  if (ctx.permissions.has(ListingPermissions.Moderate)) return true; // admins override
  if (ctx.permissions.has(perm) && ctx.userId === listingSellerUserId) return true;
  return false;
}
export function requirePermission(ctx: RequestContext, perm: ListingPermission): void {
  if (!ctx.permissions.has(perm) && !ctx.permissions.has(ListingPermissions.Moderate)) {
    const { ForbiddenError } = require('../../shared/errors/app-error');
    throw new ForbiddenError(`Missing permission: ${perm}`);
  }
}
