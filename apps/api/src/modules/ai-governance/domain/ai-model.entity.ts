// modules/ai-governance/domain/ai-model.entity.ts · a registered AI model version (ai_models, GLOBAL — no
// tenant_id). Pure domain, no framework/I/O. confidence_threshold is the line below which an inference is
// routed to a human (numeric(5,4) in [0,1]). The lifecycle (shadow→canary→production→retired) goes ONLY
// through ai-model.state.ts (Law 5). In the tenant API the registry is read-only; promote()/retire() are the
// shared lifecycle contract (admin-api), fully unit-tested here.
import { ModelStatus, DomainEvent, AiEventType } from './ai-governance.events';
import { assertTransition } from './ai-model.state';
import { InvalidAiModelError } from './ai-governance.errors';

export interface AiModelProps {
  id: string; code: string; version: string; provider: string | null; status: ModelStatus;
  confidenceThreshold: number | null; fairnessAudit: Record<string, unknown> | null; createdAt?: Date;
}
export class AiModel {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: AiModelProps) {}

  static register(input: Omit<AiModelProps, 'status' | 'fairnessAudit'> & { status?: ModelStatus }): AiModel {
    if (!input.code) throw new InvalidAiModelError('code required');
    if (!input.version) throw new InvalidAiModelError('version required');
    if (input.confidenceThreshold != null && (input.confidenceThreshold < 0 || input.confidenceThreshold > 1)) {
      throw new InvalidAiModelError('confidenceThreshold must be in [0,1]');
    }
    return new AiModel({ ...input, status: input.status ?? 'shadow', fairnessAudit: null });
  }
  static rehydrate(p: AiModelProps): AiModel { return new AiModel(p); }

  get id() { return this.props.id; }
  get code() { return this.props.code; }
  get status() { return this.props.status; }
  get confidenceThreshold() { return this.props.confidenceThreshold; }
  toProps(): Readonly<AiModelProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  /** Move the model up/down the serving ladder (validated by the state machine). */
  promote(to: ModelStatus): void {
    assertTransition(this.props.status, to);
    this.props.status = to;
    this.events.push({ type: to === 'retired' ? AiEventType.ModelRetired : AiEventType.ModelPromoted, payload: { modelId: this.props.id, code: this.props.code, status: to } });
  }
  retire(): void { this.promote('retired'); }
  recordFairnessAudit(audit: Record<string, unknown>): void { this.props.fairnessAudit = audit; }

  /** Does this inference confidence fall below the model's human-review threshold? */
  needsReview(confidence: number | null): boolean {
    if (this.props.confidenceThreshold == null) return false;
    if (confidence == null) return true;                       // no confidence reported → be safe, review
    return confidence < this.props.confidenceThreshold;
  }
  toJSON() {
    const v = this.props;
    return { id: v.id, code: v.code, version: v.version, provider: v.provider, status: v.status,
      confidenceThreshold: v.confidenceThreshold, fairnessAudit: v.fairnessAudit, createdAt: v.createdAt };
  }
}
