// apps/web-admin/src/features/ai-models/model.ts · PURE helpers for the god-mode AI-model registry. Mirrors
// admin-api ai-models-ops EXACTLY (ai-model.state machine shadow→canary→production→retired; PromoteModelSchema /
// TuneThresholdSchema zod shapes; ai-model.entity toJSON read-model). No I/O, no React.
//
// confidenceThreshold is a genuine ML CONFIDENCE RATIO in [0,1] (numeric(5,4)), NOT money — so a fractional value
// is correct here. We still avoid the float-coercion helpers the §4 audit forbids: parsing uses a decimal regex +
// unary `+`, and the 4-dp / percent renderers use integer math (Math.round + string padding), no float-format calls.

// ---- model lifecycle state machine (mirror domain/ai-model.state.ts) --------------------------------------------
export const MODEL_STATUSES = ['shadow', 'canary', 'production', 'retired'] as const;
export type ModelStatus = (typeof MODEL_STATUSES)[number];

const TRANSITIONS: Record<ModelStatus, readonly ModelStatus[]> = {
  shadow: ['canary', 'production', 'retired'],
  canary: ['production', 'shadow', 'retired'],
  production: ['canary', 'shadow', 'retired'],
  retired: [],
};

export function isModelStatus(v: string): v is ModelStatus {
  return (MODEL_STATUSES as readonly string[]).includes(v);
}
export function canTransition(from: ModelStatus, to: ModelStatus): boolean {
  return from !== to && (TRANSITIONS[from]?.includes(to) ?? false);
}
/** Legal next states from `from` — drives the promote <select> so only valid moves are offered. */
export function transitionTargets(from: ModelStatus): ModelStatus[] {
  return [...(TRANSITIONS[from] ?? [])];
}
export function isServing(s: ModelStatus): boolean {
  return s === 'canary' || s === 'production';
}
export function isTerminal(s: ModelStatus): boolean {
  return s === 'retired';
}
export function modelStatusKey(status: string): string {
  return isModelStatus(status) ? `aiModels.st.${status}` : 'aiModels.st.unknown';
}
export function modelStatusTone(status: string): 'ok' | 'warn' | 'muted' {
  if (status === 'production') return 'ok';
  if (status === 'canary') return 'warn';
  return 'muted'; // shadow / retired / unknown
}

// ---- threshold parsing + float-free ratio formatting ------------------------------------------------------------
// up to 4 decimal places, 0..1 inclusive (matches numeric(5,4)). Leading digit required (no bare ".5").
const DECIMAL_RE = /^(?:0(?:\.\d{1,4})?|1(?:\.0{1,4})?)$/;

export class ModelActionError extends Error {
  constructor(public readonly fieldKey: string) {
    super(fieldKey);
    this.name = 'ModelActionError';
  }
}

/** Parse the threshold form field: blank → null (clears it → all inferences auto-accept), else a 0..1 decimal. */
export function parseThreshold(raw: string): number | null {
  const v = (raw ?? '').trim();
  if (v.length === 0) return null;
  if (!DECIMAL_RE.test(v)) throw new ModelActionError('threshold');
  const n = +v; // safe: v matched the decimal regex
  if (n < 0 || n > 1) throw new ModelActionError('threshold');
  return n;
}

export function validReason(raw: string): string {
  const v = (raw ?? '').trim();
  if (v.length < 1 || v.length > 500) throw new ModelActionError('reason');
  return v;
}

/** Format a 0..1 ratio to exactly 4 decimals using integer math (no float-format helper). */
export function formatThreshold4(n: number | null): string | null {
  if (n === null) return null;
  const scaled = Math.round(n * 10000);
  const whole = Math.floor(scaled / 10000);
  const frac = String(scaled % 10000).padStart(4, '0');
  return `${whole}.${frac}`;
}

/** Format a 0..1 ratio as a percentage with 2 decimals using integer math (no float-format helper). */
export function formatPercent2(n: number): string {
  const scaled = Math.round(n * 10000); // ratio × 100 (percent) × 100 (2dp)
  const whole = Math.floor(scaled / 100);
  const frac = String(scaled % 100).padStart(2, '0');
  return `${whole}.${frac}%`;
}

// ---- builders (exact JSON bodies admin-api expects, incl. audit `reason`) ----------------------------------------
export interface PromoteBody { to: ModelStatus; reason: string; }
/** Mirrors PromoteModelSchema; only a legal state-machine move is allowed (admin-api re-checks). */
export function buildPromote(from: ModelStatus, toRaw: string, reason: string): PromoteBody {
  const to = (toRaw ?? '').trim();
  if (!isModelStatus(to)) throw new ModelActionError('status');
  if (!canTransition(from, to)) throw new ModelActionError('illegal');
  return { to, reason: validReason(reason) };
}

export interface TuneThresholdBody { confidenceThreshold: number | null; reason: string; }
/** Mirrors TuneThresholdSchema; confidenceThreshold is nullable (null clears it). */
export function buildTuneThreshold(rawThreshold: string, reason: string): TuneThresholdBody {
  return { confidenceThreshold: parseThreshold(rawThreshold), reason: validReason(reason) };
}

// ---- read-model types (mirror ai-model.entity toJSON + fairness report) ------------------------------------------
export interface ModelRow {
  id: string; code: string; version: string; provider: string | null;
  status: string; confidenceThreshold: number | null; createdAt?: string;
}
export interface FairnessReport {
  model: ModelRow & { fairnessAudit?: Record<string, unknown> | null };
  storedFairnessAudit: Record<string, unknown> | null;
  recent: { window: string; total: number; overridden: number; lowConfidence: number; overrideRate: number };
}
