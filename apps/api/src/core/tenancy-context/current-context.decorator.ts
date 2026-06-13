// core/tenancy-context/current-context.decorator.ts
// @CurrentContext() injects the per-request RequestContext (tenant, user, roles,
// permissions, shard, locale) resolved by the tenant-context middleware/AsyncLocalStorage.
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { getRequestContext } from './request-context';
export const CurrentContext = createParamDecorator((_data: unknown, _ctx: ExecutionContext) => getRequestContext());
