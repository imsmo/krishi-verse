// modules/ai-governance/domain/ai-model.state.ts · the ai_models.status state machine (Law 5 — the ONLY place
// model-lifecycle transitions are decided). Mirrors the status values in db/migrations/0013:
//   shadow → canary → production → retired.   A model is promoted up the ladder and eventually retired; it may
// be retired from any live stage, and a production/canary model can be rolled back to shadow. retired is
// terminal. (In the tenant API the registry is READ-ONLY; this machine is the shared contract the admin-api
// model-lifecycle uses — and is exercised by the AiModel entity's unit tests.)
import { DomainError } from '../../../shared/errors/app-error';
import { ModelStatus } from './ai-governance.events';

const TRANSITIONS: Readonly<Record<ModelStatus, readonly ModelStatus[]>> = Object.freeze({
  shadow:     ['canary', 'production', 'retired'],
  canary:     ['production', 'shadow', 'retired'],
  production: ['canary', 'shadow', 'retired'],
  retired:    [],
});

export class IllegalModelTransitionError extends DomainError {
  constructor(from: string, to: string) { super('AI_MODEL_ILLEGAL_TRANSITION', `Cannot move model ${from}→${to}`, 409, { from, to }); }
}
export function canTransition(from: ModelStatus, to: ModelStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: ModelStatus, to: ModelStatus): void { if (!canTransition(from, to)) throw new IllegalModelTransitionError(from, to); }
/** A model that is live enough to serve real inferences (its decisions count). */
export function isServing(s: ModelStatus): boolean { return s === 'canary' || s === 'production'; }
export function isTerminal(s: ModelStatus): boolean { return s === 'retired'; }
