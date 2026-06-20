// apps/admin-api/src/core/auth/step-up-reauth.guard.ts · sensitive god-mode mutations require a RECENT strong
// re-auth (JIT elevation). The token's auth_time must be within ADMIN_STEP_UP_MAX_AGE_SEC of now; otherwise the
// operator must re-authenticate. Throws 403 when stale or absent (fail-closed). Runs after AdminAuthGuard.
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AdminConfig } from '../config/admin-config';
import { AdminRequestContext } from './admin-auth.guard';

@Injectable()
export class StepUpReauthGuard implements CanActivate {
  constructor(private readonly config: AdminConfig) {}
  canActivate(ctx: ExecutionContext): boolean {
    const admin: AdminRequestContext | undefined = ctx.switchToHttp().getRequest().admin;
    const nowSec = Math.floor(Date.now() / 1000);
    if (!admin || !admin.authTimeSec || nowSec - admin.authTimeSec > this.config.env.ADMIN_STEP_UP_MAX_AGE_SEC) {
      throw new ForbiddenException('step-up re-authentication required for this operation');
    }
    return true;
  }
}
