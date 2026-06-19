// modules/land-soil-weather/policies/land-soil-weather.policies.ts · permission keys (DB-backed RBAC, Law 6; seeded 0004).
//   land.manage — a farmer manages their OWN parcels, crop seasons, and soil tests.
// Browsing weather alerts (global region advisories) is any authenticated tenant user.
import { RequestContext } from '../../../core/tenancy-context/request-context';
export const LandPermissions = { Manage: 'land.manage' } as const;
export const canManageLand = (ctx: RequestContext) => ctx.permissions.has('land.manage') || ctx.permissions.has('*');
export const isLandAdmin = (ctx: RequestContext) => ctx.permissions.has('booking.manage') || ctx.permissions.has('*');
