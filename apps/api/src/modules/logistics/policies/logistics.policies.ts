// modules/logistics/policies/logistics.policies.ts · permission keys (DB-backed RBAC, Law 6).
import { RequestContext } from '../../../core/tenancy-context/request-context';
// Tenant logistics operators (3PL desk / dispatch) hold logistics.manage. Riders need no permission —
// they act ONLY on shipments assigned to them (rider_user_id), enforced per-row in the service.
export const ShipmentPermissions = { Manage: 'logistics.manage' } as const;
export function canManageLogistics(ctx: RequestContext): boolean {
  return ctx.permissions.has('logistics.manage') || ctx.permissions.has('*');
}
