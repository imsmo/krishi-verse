// core/auth/auth.guard.ts
// Authentication gate. The tenant-context middleware has already verified the JWT
// (if any) and populated RequestContext. This guard simply enforces presence:
//   • @Public() routes  → always allowed (anonymous browse), tenant still resolved
//   • everything else   → requires an authenticated user id in context
// Authorization (which permissions) is handled separately by PermissionsGuard.
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';
import { tryGetRequestContext } from '../tenancy-context/request-context';
import { UnauthorizedError } from '../../shared/errors/app-error';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]) ?? false;
    const rc = tryGetRequestContext();
    if (isPublic) return true;
    if (!rc || !rc.userId) throw new UnauthorizedError();
    return true;
  }
}
