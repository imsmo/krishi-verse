// modules/market-intel/policies/market-intel.policies.ts · permission keys (DB-backed RBAC, Law 6; seeded 0004).
//   market.manage — ingest mandi price observations + generate fair-price predictions (ops/admin/ambassador
//   field staff). Browsing the Mandi Pulse + managing one's OWN price alerts need only authentication (no IDOR).
import { RequestContext } from '../../../core/tenancy-context/request-context';
export const MarketPermissions = { Manage: 'market.manage' } as const;
export const canManageMarket = (ctx: RequestContext) => ctx.permissions.has('market.manage') || ctx.permissions.has('*');
