// apps/admin-api/src/core/auth/hardware-key.guard.ts · enforces FIDO2/hardware-key 2FA for god-mode requests.
// The WebAuthn ceremony happens at admin login; the resulting token carries amr=['hwk',...]. This guard enforces
// that claim is present (when ADMIN_REQUIRE_HARDWARE_KEY is on — always on in production, §4 fail-closed). Throws
// 403 otherwise. Runs after AdminAuthGuard (req.admin populated).
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AdminConfig } from '../config/admin-config';
import { AdminRequestContext } from './admin-auth.guard';

@Injectable()
export class HardwareKeyGuard implements CanActivate {
  constructor(private readonly config: AdminConfig) {}
  canActivate(ctx: ExecutionContext): boolean {
    if (!this.config.env.ADMIN_REQUIRE_HARDWARE_KEY) return true;
    const admin: AdminRequestContext | undefined = ctx.switchToHttp().getRequest().admin;
    if (!admin || !admin.amr.includes('hwk')) throw new ForbiddenException('hardware-key (FIDO2) re-auth required');
    return true;
  }
}
