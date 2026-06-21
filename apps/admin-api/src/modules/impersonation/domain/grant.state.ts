// apps/admin-api/src/modules/impersonation/domain/grant.state.ts · the impersonation-grant lifecycle state machine
// (Law 5 — the ONLY place transitions are decided). Mirrors the CHECK in db/migrations/0038:
//   active → ended (operator finished) | expired (TTL elapsed) | revoked (security/oversight pulled it)
// ended/expired/revoked are terminal. A grant only ever moves OUT of active — it can never be re-opened.
export const GRANT_STATUSES = ['active', 'ended', 'expired', 'revoked'] as const;
export type GrantStatus = (typeof GRANT_STATUSES)[number];

import { IllegalGrantTransitionError } from './impersonation.errors';

const TRANSITIONS: Readonly<Record<GrantStatus, readonly GrantStatus[]>> = Object.freeze({
  active:  ['ended', 'expired', 'revoked'],
  ended:   [],
  expired: [],
  revoked: [],
});

export function canTransition(from: GrantStatus, to: GrantStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}
export function assertTransition(from: GrantStatus, to: GrantStatus): void {
  if (!canTransition(from, to)) throw new IllegalGrantTransitionError(from, to);
}
export function isTerminal(s: GrantStatus): boolean { return s !== 'active'; }
