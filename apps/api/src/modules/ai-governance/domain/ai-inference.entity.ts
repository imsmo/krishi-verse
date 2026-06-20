// modules/ai-governance/domain/ai-inference.entity.ts · one logged AI decision (ai_inferences, append-only,
// PARTITIONED by created_at). Pure domain. This is the explainability/audit record: which model decided what
// about which subject, with what confidence. input_ref holds POINTERS ONLY (ids/digests) — NEVER raw PII
// (Law / §4). An accepted/rejected human review can mark it was_overridden.
import { InvalidInferenceError } from './ai-governance.errors';

export interface AiInferenceProps {
  id?: string;                       // bigserial (string-encoded) — assigned by the DB on insert
  tenantId: string | null;
  modelId: string;
  subjectType: string;
  subjectId: string;
  inputRef: Record<string, unknown>;
  output: Record<string, unknown>;
  confidence: number | null;
  wasOverridden: boolean;
  overrideBy: string | null;
  overrideReason: string | null;
  createdAt?: Date;
}

const PII_KEYS = /(aadhaar|pan|phone|mobile|email|otp|password|account|ifsc|address|name)/i;

export class AiInference {
  private constructor(private props: AiInferenceProps) {}

  static record(input: { tenantId: string | null; modelId: string; subjectType: string; subjectId: string;
    inputRef: Record<string, unknown>; output: Record<string, unknown>; confidence: number | null; }): AiInference {
    if (!input.subjectType) throw new InvalidInferenceError('subjectType required');
    if (!input.subjectId) throw new InvalidInferenceError('subjectId required');
    if (input.confidence != null && (input.confidence < 0 || input.confidence > 1)) throw new InvalidInferenceError('confidence must be in [0,1]');
    // Defence in depth: the input_ref must be pointers, never PII. Reject obvious PII keys at the domain edge.
    for (const k of Object.keys(input.inputRef ?? {})) if (PII_KEYS.test(k)) throw new InvalidInferenceError(`input_ref must not carry PII (key "${k}")`);
    return new AiInference({ ...input, inputRef: input.inputRef ?? {}, wasOverridden: false, overrideBy: null, overrideReason: null });
  }
  static rehydrate(p: AiInferenceProps): AiInference { return new AiInference(p); }

  get id() { return this.props.id; }
  get confidence() { return this.props.confidence; }
  get subjectType() { return this.props.subjectType; }
  get subjectId() { return this.props.subjectId; }
  toProps(): Readonly<AiInferenceProps> { return Object.freeze({ ...this.props }); }

  markOverridden(by: string, reason: string | null): void {
    this.props.wasOverridden = true; this.props.overrideBy = by; this.props.overrideReason = reason;
  }
  toJSON() {
    const v = this.props;
    return { id: v.id, modelId: v.modelId, subjectType: v.subjectType, subjectId: v.subjectId, inputRef: v.inputRef,
      output: v.output, confidence: v.confidence, wasOverridden: v.wasOverridden, overrideBy: v.overrideBy,
      overrideReason: v.overrideReason, createdAt: v.createdAt };
  }
}
