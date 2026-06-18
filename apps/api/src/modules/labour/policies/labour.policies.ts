// modules/labour/policies/labour.policies.ts · permission keys (DB-backed RBAC, Law 6; seeded in 0004).
//   worker.book      — an EMPLOYER (farmer/FPO) may post bookings, assign workers, start/complete/pay.
//   booking.manage   — tenant admin oversight (cancel/list-all/pay on behalf of).
// Registering a worker profile and a worker RESPONDING to their own assignment is any authenticated user.
import { RequestContext } from '../../../core/tenancy-context/request-context';

export const LabourPermissions = { Book: 'worker.book', Manage: 'booking.manage' } as const;

export function canBookLabour(ctx: RequestContext): boolean {
  return ctx.permissions.has('worker.book') || ctx.permissions.has('booking.manage') || ctx.permissions.has('*');
}
export function canManageLabour(ctx: RequestContext): boolean {
  return ctx.permissions.has('booking.manage') || ctx.permissions.has('*');
}
