// modules/exports/policies/exports.policies.ts · permission keys (DB-backed RBAC, Law 6; seeded in 0004).
//   export.manage — an exporter: register RCMC/IEC, create + drive shipments, manage the document checklist.
// Browsing compliance requirements (global reference data) is any authenticated tenant user.
import { RequestContext } from '../../../core/tenancy-context/request-context';
export const ExportsPermissions = { Manage: 'export.manage' } as const;
export const canManageExports = (ctx: RequestContext) => ctx.permissions.has('export.manage') || ctx.permissions.has('*');
export const isExportsAdmin = (ctx: RequestContext) => ctx.permissions.has('booking.manage') || ctx.permissions.has('*');
