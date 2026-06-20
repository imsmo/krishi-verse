// apps/admin-api/src/modules/ai-models-ops/domain/ai-model.state.ts · the ai_models.status state machine
// (Law 5 — the ONLY place model-lifecycle transitions are decided). This is the AUTHORITATIVE owner of the
// lifecycle (apps/api/modules/ai-governance holds a read-only mirror). Mirrors the status values in
// db/migrations/0013:  shadow → canary → production → retired.
export const MODEL_STATUSES = ['shadow', 'canary', 'production', 'retired'] as const;
export type ModelStatus = (typeof MODEL_STATUSES)[number];

const TRANSITIONS: Readonly<Record<ModelStatus, readonly ModelStatus[]>> = Object.freeze({
  shadow:     ['canary', 'production', 'retired'],
  canary:     ['production', 'shadow', 'retired'],
  production: ['canary', 'shadow', 'retired'],
  retired:    [],
});

export class IllegalModelTransitionError extends Error {
  readonly code = 'AI_MODEL_ILLEGAL_TRANSITION';
  constructor(public readonly from: string, public readonly to: string) { super(`Cannot move model ${from}→${to}`); this.name = 'IllegalModelTransitionError'; }
}
export function canTransition(from: ModelStatus, to: ModelStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: ModelStatus, to: ModelStatus): void { if (!canTransition(from, to)) throw new IllegalModelTransitionError(from, to); }
export function isServing(s: ModelStatus): boolean { return s === 'canary' || s === 'production'; }
export function isTerminal(s: ModelStatus): boolean { return s === 'retired'; }
