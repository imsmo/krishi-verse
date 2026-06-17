// core/feature-flags/flags.guard.ts
// @FeatureFlag('catalogue.write') gates a route behind a flag. If the flag is OFF for
// the caller, returns 404 (NOT 403) — a disabled feature should be invisible, never
// "exists but forbidden". Kill-switch: flip feature_flags.is_enabled=false → instant off.
import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FlagsService } from './flags.service';
import { tryGetRequestContext } from '../tenancy-context/request-context';
import { NotFoundError } from '../../shared/errors/app-error';

export const FEATURE_FLAG_KEY = 'feature_flag';
export const FeatureFlag = (key: string) => SetMetadata(FEATURE_FLAG_KEY, key);

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly flags: FlagsService) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const key = this.reflector.getAllAndOverride<string>(FEATURE_FLAG_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!key) return true;
    const rc = tryGetRequestContext();
    const on = await this.flags.isEnabled(key, { tenantId: rc?.tenantId, userId: rc?.userId });
    if (!on) throw new NotFoundError('Not found'); // invisible when disabled
    return true;
  }
}
