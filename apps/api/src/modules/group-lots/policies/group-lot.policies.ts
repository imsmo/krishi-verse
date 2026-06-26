// modules/group-lots/policies/group-lot.policies.ts · permission keys (DB-backed RBAC, Law 6).
//   group_lot.coordinate — an FPO/coordinator: open lots, record pledges, mark ready, cancel, settle shares.
//   Browsing open lots + viewing one's own pledge is any authenticated tenant user (no perm).
import { RequestContext } from '../../../core/tenancy-context/request-context';
export const GroupLotPermissions = { Coordinate: 'group_lot.coordinate' } as const;
export const canCoordinate = (ctx: RequestContext) => ctx.permissions.has('group_lot.coordinate') || ctx.permissions.has('*');
