// apps/admin-api/src/core/auth/admin-auth.guard.ts · authenticates every admin request: verifies the admin JWT
// (self-contained HS256, iss/aud/exp pinned), resolves owner-role permissions from the static catalog, and
// attaches the principal to req.admin. Throws 401 on any failure (fail-closed). No tenant context exists here —
// admin-api is a separate realm (Law 11).
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AdminConfig } from '../config/admin-config';
import { verifyAdminToken, AdminTokenError, AdminPrincipal } from './admin-jwt.strategy';
import { resolveOwnerPermissions } from '../rbac/owner-roles';

export interface AdminRequestContext extends AdminPrincipal { permissions: Set<string>; ip: string | null; requestId: string; }

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly config: AdminConfig) {}
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const header: string = req.headers?.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    let principal: AdminPrincipal;
    try { principal = verifyAdminToken(token, this.config); }
    catch (e) { throw new UnauthorizedException(e instanceof AdminTokenError ? e.message : 'unauthorized'); }
    const admin: AdminRequestContext = {
      ...principal,
      permissions: resolveOwnerPermissions(principal.roles),
      ip: req.ip ?? req.socket?.remoteAddress ?? null,
      requestId: String(req.headers?.['x-request-id'] ?? ''),
    };
    req.admin = admin;
    return true;
  }
}
