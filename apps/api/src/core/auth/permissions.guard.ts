// core/auth/permissions.guard.ts
// Dynamic RBAC enforcement (Law 9). @RequirePermissions(...) sets metadata; the guard
// reads the caller's resolved permission set from RequestContext (role grants + per-user
// overrides, loaded by tenant-context middleware) and allows only if all are present.
import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getRequestContext } from '../tenancy-context/request-context';

export const PERMISSIONS_KEY = 'required_permissions';
export const RequirePermissions = (...perms: string[]) => SetMetadata(PERMISSIONS_KEY, perms);

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [ctx.getHandler(), ctx.getClass()]) ?? [];
    if (required.length === 0) return true;
    const rc = getRequestContext();
    const ok = required.every((p) => rc.permissions.has(p) || rc.permissions.has('*'));
    if (!ok) { const { ForbiddenError } = require('../../shared/errors/app-error'); throw new ForbiddenError(`Missing permission(s): ${required.join(', ')}`); }
    return true;
  }
}
