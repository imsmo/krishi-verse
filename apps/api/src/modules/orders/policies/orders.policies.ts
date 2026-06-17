// modules/orders/policies/orders.policies.ts · permission keys (DB-backed RBAC, Law 6).
import { RequestContext } from '../../../core/tenancy-context/request-context';
export const OrderPermissions = { Create: 'order.create', Manage: 'order.manage' } as const;
/** Platform/tenant-admin moderation (resolve disputes, force transitions). NOT god-mode. */
export function canModerateOrder(ctx: RequestContext): boolean {
  return ctx.permissions.has('dispute.resolve') || ctx.permissions.has('*');
}
