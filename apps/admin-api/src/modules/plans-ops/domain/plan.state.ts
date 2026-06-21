// apps/admin-api/src/modules/plans-ops/domain/plan.state.ts · the SaaS-plan lifecycle state machine (Law 5 — the
// ONLY place transitions are decided). Mirrors the CHECK in db/migrations/0037:
//   draft → active (publish) → archived (retire) → active (reactivate)
//   draft → archived (discard a never-published plan)
// A plan's sellability flag `is_active` tracks this: active ⇒ is_active=true; draft/archived ⇒ false.
export const PLAN_STATUSES = ['draft', 'active', 'archived'] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

import { IllegalPlanTransitionError } from './plans-ops.errors';

const TRANSITIONS: Readonly<Record<PlanStatus, readonly PlanStatus[]>> = Object.freeze({
  draft:    ['active', 'archived'],
  active:   ['archived'],
  archived: ['active'],
});

export function canTransition(from: PlanStatus, to: PlanStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}
export function assertTransition(from: PlanStatus, to: PlanStatus): void {
  if (!canTransition(from, to)) throw new IllegalPlanTransitionError(from, to);
}
/** Sellability: only an active plan is offered/billable. */
export function isActiveStatus(s: PlanStatus): boolean { return s === 'active'; }
