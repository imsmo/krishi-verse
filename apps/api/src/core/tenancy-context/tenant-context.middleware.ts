// core/tenancy-context/tenant-context.middleware.ts
// Establishes the per-request ambient RequestContext (AsyncLocalStorage) for the
// WHOLE request. Order (Law 1): request-id → THIS → guards → controller. It:
//   • verifies the JWT (TenantResolver) → user/tenant/roles/permissions, OR
//   • for anonymous storefront reads, takes tenant from the X-Tenant-Id header,
//   • resolves the tenant→shard, locale, and request id,
//   • runs the rest of the pipeline inside runWithContext so every layer (repo,
//     service, guard) can read tenant/user without threading them through.
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { runWithContext, RequestContext } from './request-context';
import { TenantResolver } from './tenant-resolver';
import { ShardRouter } from '../sharding/shard-router';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly resolver: TenantResolver, private readonly shards: ShardRouter) {}

  use(req: Request & { requestId?: string }, _res: Response, next: NextFunction): void {
    const principal = this.resolver.fromAuthHeader(req.headers.authorization);
    const headerTenant = (req.headers['x-tenant-id'] as string | undefined) ?? '';
    const tenantId = principal?.tenantId || headerTenant;
    const lang = ((req.headers['x-lang'] as string) || (req.headers['accept-language'] as string) || 'en-IN').split(',')[0];

    const ctx: RequestContext = {
      tenantId,
      userId: principal?.userId ?? '',
      sessionId: principal?.sessionId ?? '',
      requestId: req.requestId ?? '',
      lang,
      roles: principal?.roles ?? [],
      permissions: new Set(principal?.permissions ?? []),
      shardId: tenantId ? this.shards.shardFor(tenantId) : 0,
    };
    runWithContext(ctx, () => next());
  }
}
