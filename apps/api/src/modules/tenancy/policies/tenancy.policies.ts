// modules/tenancy/policies/tenancy.policies.ts · permission keys (DB-backed RBAC, Law 6).
import { RequestContext } from '../../../core/tenancy-context/request-context';
// The GLOBAL plan catalogue is platform-admin only (plan.manage = god-mode, Law 11). A tenant manages
// its OWN subscription with tenant.settings (its admin) — or a platform admin (plan.manage) can too.
export const TenancyPermissions = { ManagePlans: 'plan.manage', ManageSub: 'tenant.settings' } as const;
export function canManagePlans(ctx: RequestContext): boolean { return ctx.permissions.has('plan.manage') || ctx.permissions.has('*'); }
export function canManageSubscription(ctx: RequestContext): boolean { return ctx.permissions.has('tenant.settings') || ctx.permissions.has('plan.manage') || ctx.permissions.has('*'); }
export function actorOf(ctx: RequestContext) { return { userId: ctx.userId, tenantId: ctx.tenantId, canManagePlans: canManagePlans(ctx), canManageSub: canManageSubscription(ctx) }; }
