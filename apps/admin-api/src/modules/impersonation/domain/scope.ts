// apps/admin-api/src/modules/impersonation/domain/scope.ts · pure guards that bound an act-as grant. These encode
// the deliberate safety limits: impersonation is READ-ONLY only (write/full is excluded by design), strictly
// TIME-BOXED (ttl ≤ the configured hard cap), and an operator can never impersonate themselves. The scope value
// is what the minted token carries — there is NO path to money/god/write perms through impersonation.
import { InvalidScopeError, InvalidTtlError, SelfImpersonationError } from './impersonation.errors';

export const IMPERSONATION_SCOPES = ['read_only'] as const;
export type ImpersonationScope = (typeof IMPERSONATION_SCOPES)[number];

/** Only 'read_only' is permitted. Write/full impersonation is intentionally NOT supported (would need its own
 *  design + CODEOWNERS review); anything else is refused. */
export function assertScope(scope: string): ImpersonationScope {
  if (scope !== 'read_only') throw new InvalidScopeError("only 'read_only' impersonation is permitted");
  return 'read_only';
}

/** ttl must be a positive integer within the hard cap (time-box). Returns the clamped-validated ttl. */
export function assertTtl(ttlSec: number, maxTtlSec: number): number {
  if (!Number.isInteger(ttlSec) || ttlSec <= 0) throw new InvalidTtlError('ttlSec must be a positive integer (seconds)');
  if (ttlSec > maxTtlSec) throw new InvalidTtlError(`ttlSec exceeds the hard cap of ${maxTtlSec}s`);
  return ttlSec;
}

export function assertNotSelf(adminUserId: string, targetUserId: string): void {
  if (adminUserId === targetUserId) throw new SelfImpersonationError();
}
