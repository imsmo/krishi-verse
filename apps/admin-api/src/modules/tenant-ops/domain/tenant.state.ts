// apps/admin-api/src/modules/tenant-ops/domain/tenant.state.ts · the tenant_status state machine (Law 5 — the
// ONLY place tenant-lifecycle transitions are decided). Mirrors the tenant_status enum in db/migrations/0002:
//   pending → trial → active → grace → suspended → archived → terminated.
// This is the AUTHORITATIVE owner of platform-driven tenant lifecycle (the tenant API can request onboarding
// but only the god-mode plane approves/suspends/archives — Law 11). Every transition is audited + emits a
// tenant_status_events row.
export const TENANT_STATUSES = ['pending', 'trial', 'active', 'grace', 'suspended', 'archived', 'terminated'] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

// Allowed moves. Forward through the lifecycle; suspend/archive/terminate from the live states; reactivate from
// suspended/grace. archived → terminated only (hard end); terminated is terminal.
const TRANSITIONS: Readonly<Record<TenantStatus, readonly TenantStatus[]>> = Object.freeze({
  pending:    ['trial', 'active', 'archived', 'terminated'],
  trial:      ['active', 'grace', 'suspended', 'archived', 'terminated'],
  active:     ['grace', 'suspended', 'archived', 'terminated'],
  grace:      ['active', 'suspended', 'archived', 'terminated'],
  suspended:  ['active', 'archived', 'terminated'],
  archived:   ['terminated'],
  terminated: [],
});

export class IllegalTenantTransitionError extends Error {
  readonly code = 'TENANT_ILLEGAL_TRANSITION';
  constructor(public readonly from: string, public readonly to: string) {
    super(`Cannot move tenant ${from}→${to}`);
    this.name = 'IllegalTenantTransitionError';
  }
}
export function canTransition(from: TenantStatus, to: TenantStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}
export function assertTransition(from: TenantStatus, to: TenantStatus): void {
  if (!canTransition(from, to)) throw new IllegalTenantTransitionError(from, to);
}
export function isLive(s: TenantStatus): boolean { return s === 'trial' || s === 'active' || s === 'grace'; }
export function isTerminal(s: TenantStatus): boolean { return s === 'terminated'; }
