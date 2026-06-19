// modules/warehousing/policies/warehousing.policies.ts · permission keys (DB-backed RBAC, Law 6; seeded in 0004).
//   warehouse.manage — the warehouse operator: list warehouses, confirm/store/release bookings (collect the
//                      storage fee), record assays, issue/release eNWRs.
//   warehouse.store  — a depositor: request a storage booking + cancel their own.
import { RequestContext } from '../../../core/tenancy-context/request-context';
export const WarehousingPermissions = { Manage: 'warehouse.manage', Store: 'warehouse.store' } as const;
export const canManageWarehouse = (ctx: RequestContext) => ctx.permissions.has('warehouse.manage') || ctx.permissions.has('*');
export const canStore = (ctx: RequestContext) => ctx.permissions.has('warehouse.store') || ctx.permissions.has('*');
export const isWarehouseAdmin = (ctx: RequestContext) => ctx.permissions.has('booking.manage') || ctx.permissions.has('*');
