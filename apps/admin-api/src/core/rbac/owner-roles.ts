// apps/admin-api/src/core/rbac/owner-roles.ts · the platform OWNER-role permission catalog (Law 11).
// These are PLATFORM roles, defined HERE in the god-mode realm — never in the tenant DB's role_permissions
// (a tenant admin can NEVER be granted these). Least-privilege: each owner role lists exactly the platform
// permissions it holds; super_admin holds '*'. Permissions resolve from the token's roles claim against this
// static catalog — never trusted directly from the client.
import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const OwnerPermissions = {
  AiModelManage: 'ai.model.manage',     // register/promote/retire models + tune thresholds
  AiModelRead: 'ai.model.read',         // browse the registry + fairness reports
} as const;
export type OwnerPermission = (typeof OwnerPermissions)[keyof typeof OwnerPermissions];

// role code → permissions. '*' = god mode (everything).
const OWNER_ROLE_GRANTS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  super_admin:       ['*'],
  platform_ai_ops:   [OwnerPermissions.AiModelManage, OwnerPermissions.AiModelRead],
  platform_ai_auditor: [OwnerPermissions.AiModelRead],
});

/** Flatten a token's roles to a permission set against the static owner catalog (unknown roles grant nothing). */
export function resolveOwnerPermissions(roles: string[]): Set<string> {
  const perms = new Set<string>();
  for (const r of roles) for (const p of OWNER_ROLE_GRANTS[r] ?? []) perms.add(p);
  return perms;
}
export function hasOwnerPermission(perms: Set<string>, needed: string): boolean { return perms.has('*') || perms.has(needed); }

export const REQUIRE_OWNER_PERMISSION = 'require_owner_permission';
export const RequireOwnerPermission = (perm: OwnerPermission) => SetMetadata(REQUIRE_OWNER_PERMISSION, perm);

/** Guard that THROWS (never logs) when the principal lacks the required owner permission (Law 6 / §4). */
@Injectable()
export class OwnerPermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const needed = this.reflector.getAllAndOverride<string>(REQUIRE_OWNER_PERMISSION, [ctx.getHandler(), ctx.getClass()]);
    if (!needed) return true;
    const req = ctx.switchToHttp().getRequest();
    const perms: Set<string> = req.admin?.permissions ?? new Set();
    if (!hasOwnerPermission(perms, needed)) throw new ForbiddenException(`missing owner permission: ${needed}`);
    return true;
  }
}
