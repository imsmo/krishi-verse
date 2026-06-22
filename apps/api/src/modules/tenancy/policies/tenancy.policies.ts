// modules/tenancy/policies/tenancy.policies.ts · permission keys (DB-backed RBAC, Law 6).
import { RequestContext } from '../../../core/tenancy-context/request-context';
// The GLOBAL plan catalogue is platform-admin only (plan.manage = god-mode, Law 11). A tenant manages
// its OWN subscription with tenant.settings (its admin) — or a platform admin (plan.manage) can too.
export const TenancyPermissions = { ManagePlans: 'plan.manage', ManageSub: 'tenant.settings', ManageTenant: 'tenant.settings' } as const;
export function canManagePlans(ctx: RequestContext): boolean { return ctx.permissions.has('plan.manage') || ctx.permissions.has('*'); }
export function canManageSubscription(ctx: RequestContext): boolean { return ctx.permissions.has('tenant.settings') || ctx.permissions.has('plan.manage') || ctx.permissions.has('*'); }
// A tenant admin (tenant.settings) self-serves its OWN tenant profile/domains/settings. There is no god-mode here:
// lifecycle (status), feature grants, and provisioning live in apps/admin-api (Law 11).
export function canManageTenant(ctx: RequestContext): boolean { return ctx.permissions.has('tenant.settings') || ctx.permissions.has('*'); }
export function actorOf(ctx: RequestContext) { return { userId: ctx.userId, tenantId: ctx.tenantId, canManagePlans: canManagePlans(ctx), canManageSub: canManageSubscription(ctx) }; }
export interface TenantActor { userId: string; canManage: boolean; }
export function tenantActorOf(ctx: RequestContext): TenantActor { return { userId: ctx.userId, canManage: canManageTenant(ctx) }; }
