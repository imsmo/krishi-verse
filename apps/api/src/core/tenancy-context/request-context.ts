// core/tenancy-context/request-context.ts
// The per-request ambient context for the API. Carried in AsyncLocalStorage so any
// layer (repo, service, guard) can read tenant/user/shard/permissions without
// threading them through every signature. Set once by tenant-context.middleware
// after authn + RBAC resolution; immutable for the rest of the request.
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  tenantId: string;
  userId: string;            // '' on anonymous read paths; populated after AuthGuard
  requestId: string;
  lang: string;              // resolved locale, e.g. 'hi-IN'
  roles: string[];           // role codes granted to the caller in this tenant
  permissions: Set<string>;  // flattened permission keys (role grants + overrides). '*' = god mode
  shardId: number;           // tenant→shard resolution for write routing
}

export abstract class RequestContextService { abstract get(): RequestContext; }
export const REQUEST_CONTEXT = Symbol('REQUEST_CONTEXT');

const als = new AsyncLocalStorage<RequestContext>();

/** Run `fn` with `ctx` bound as the ambient request context. */
export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
  return als.run(ctx, fn);
}

/** Read the ambient context. Throws if called outside a request scope (programmer error). */
export function getRequestContext(): RequestContext {
  const ctx = als.getStore();
  if (!ctx) throw new Error('RequestContext accessed outside of a request scope');
  return ctx;
}

/** Best-effort read (returns undefined off-request) — for logging/metrics enrichers. */
export function tryGetRequestContext(): RequestContext | undefined {
  return als.getStore();
}
