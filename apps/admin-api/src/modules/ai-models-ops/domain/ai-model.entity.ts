// apps/admin-api/src/modules/ai-models-ops/domain/ai-model.entity.ts · the authoritative AI-model registry
// entity (ai_models, GLOBAL). Pure domain, no I/O. confidence_threshold is numeric(5,4) in [0,1] — below it an
// inference is routed to human review (consumed by apps/api/ai-governance). Lifecycle goes ONLY through
// ai-model.state.ts (Law 5). Promotion across tenants is consequential, hence this lives in the god-mode realm.
import { ModelStatus, assertTransition } from './ai-model.state';
import { InvalidAiModelError } from './ai-models.errors';

export interface AiModelProps {
  id: string; code: string; version: string; provider: string | null; status: ModelStatus;
  confidenceThreshold: number | null; fairnessAudit: Record<string, unknown> | null; createdAt?: Date;
}
export class AiModel {
  private constructor(private props: AiModelProps) {}

  static register(input: { id: string; code: string; version: string; provider: string | null; confidenceThreshold: number | null; status?: ModelStatus }): AiModel {
    if (!input.code || !/^[a-z0-9_]{2,80}$/.test(input.code)) throw new InvalidAiModelError('code must be 2-80 chars of [a-z0-9_]');
    if (!input.version || input.version.length > 30) throw new InvalidAiModelError('version required (<=30 chars)');
    AiModel.assertThreshold(input.confidenceThreshold);
    return new AiModel({ id: input.id, code: input.code, version: input.version, provider: input.provider,
      status: input.status ?? 'shadow', confidenceThreshold: input.confidenceThreshold, fairnessAudit: null });
  }
  static rehydrate(p: AiModelProps): AiModel { return new AiModel(p); }
  private static assertThreshold(t: number | null): void {
    if (t != null && (t < 0 || t > 1)) throw new InvalidAiModelError('confidenceThreshold must be in [0,1]');
  }

  get id() { return this.props.id; }
  get code() { return this.props.code; }
  get status() { return this.props.status; }
  toProps(): Readonly<AiModelProps> { return Object.freeze({ ...this.props }); }

  /** Move up/down the serving ladder (validated by the state machine). Returns {from,to} for the audit row. */
  promote(to: ModelStatus): { from: ModelStatus; to: ModelStatus } {
    const from = this.props.status;
    assertTransition(from, to);
    this.props.status = to;
    return { from, to };
  }
  retire(): { from: ModelStatus; to: ModelStatus } { return this.promote('retired'); }
  tuneThreshold(t: number | null): { from: number | null; to: number | null } {
    AiModel.assertThreshold(t);
    const from = this.props.confidenceThreshold;
    this.props.confidenceThreshold = t;
    return { from, to: t };
  }
  toJSON() {
    const v = this.props;
    return { id: v.id, code: v.code, version: v.version, provider: v.provider, status: v.status,
      confidenceThreshold: v.confidenceThreshold, fairnessAudit: v.fairnessAudit, createdAt: v.createdAt };
  }
}
