// apps/mobile/src/core/offline/scope.ts · the CURRENT cache scope = the signed-in user id (or 'anon'). The auth
// store sets it on sign-in and clears it on sign-out, so every cached read is namespaced to its owner and one
// account can never read another's cached data (anti-IDOR, guide §4). On sign-out we also wipe the old scope's
// cache. Module-level (mirrors how the API client reads the in-memory token getter).
import { cache } from './sqlite.db';

let scope = 'anon';

export function currentScope(): string { return scope; }

/** Set the active cache scope (the user id). Idempotent. */
export function setCacheScope(userId: string | undefined | null): void { scope = userId || 'anon'; }

/** Clear the cache for the current scope and reset to anonymous (call on sign-out). */
export async function clearCacheScope(): Promise<void> {
  const prev = scope;
  scope = 'anon';
  await cache.clearScope(prev);
}
