// apps/admin-api/src/modules/flags-ops/domain/rollout.ts · pure percent-rollout + targeting rules. The eval here
// MIRRORS the runtime evaluator EXACTLY (apps/api core/feature-flags/flags.service.ts) so the console can preview
// who a flag is on for, and so unit tests prove parity. The persisted `rules` use snake_case keys
// (tenant_ids/plans/countries) — the shape the runtime reads — even though the DTO is camelCase.
import { InvalidRolloutError, InvalidTargetingError, InvalidFlagKeyError } from './flags-ops.errors';

export interface TargetingRules { tenant_ids?: string[]; plans?: string[]; countries?: string[] }
export interface FlagSnapshot { isEnabled: boolean; rolloutPct: number; rules: TargetingRules }
export interface FlagContext { tenantId?: string; userId?: string }

// Bounds (abuse/DoS guard §4): an allowlist can't be unbounded.
export const MAX_TENANT_IDS = 1000;
export const MAX_PLANS = 200;
export const MAX_COUNTRIES = 300;
const FLAG_KEY_RE = /^[a-z][a-z0-9_.]{1,79}$/;   // linear, ReDoS-safe; mirrors the runtime key space
const PLAN_RE = /^[a-z0-9_]{1,40}$/;
const CC_RE = /^[A-Z]{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertFlagKey(key: string): string {
  if (!FLAG_KEY_RE.test(key)) throw new InvalidFlagKeyError("key must match ^[a-z][a-z0-9_.]{1,79}$");
  return key;
}

export function assertRolloutPct(pct: number): number {
  if (!Number.isInteger(pct) || pct < 0 || pct > 100) throw new InvalidRolloutError('rollout_pct must be an integer 0..100');
  return pct;
}

/** Validate + normalise targeting into the persisted snake_case shape; throws InvalidTargetingError. */
export function buildTargeting(input: { tenantIds?: string[]; plans?: string[]; countries?: string[] }): TargetingRules {
  const tenant_ids = input.tenantIds ?? [];
  const plans = input.plans ?? [];
  const countries = input.countries ?? [];
  if (tenant_ids.length > MAX_TENANT_IDS) throw new InvalidTargetingError(`tenant_ids exceeds ${MAX_TENANT_IDS}`);
  if (plans.length > MAX_PLANS) throw new InvalidTargetingError(`plans exceeds ${MAX_PLANS}`);
  if (countries.length > MAX_COUNTRIES) throw new InvalidTargetingError(`countries exceeds ${MAX_COUNTRIES}`);
  if (!tenant_ids.every((t) => UUID_RE.test(t))) throw new InvalidTargetingError('tenant_ids must be uuids');
  if (!plans.every((p) => PLAN_RE.test(p))) throw new InvalidTargetingError('plan codes must match ^[a-z0-9_]{1,40}$');
  if (!countries.every((c) => CC_RE.test(c))) throw new InvalidTargetingError('countries must be ISO-3166 alpha-2');
  return { tenant_ids, plans, countries };
}

/** Stable 0–99 bucket from a string (FNV-1a) — byte-identical to the runtime evaluator. */
export function bucket(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h) % 100;
}

/** Preview resolution for a (flag, context) — MUST match apps/api core/feature-flags/flags.service.ts. */
export function isEnabledFor(key: string, flag: FlagSnapshot, ctx: FlagContext = {}): boolean {
  if (!flag.isEnabled) return false;                                   // unknown/kill-switched ⇒ OFF
  const allow = flag.rules?.tenant_ids ?? [];
  if (ctx.tenantId && allow.includes(ctx.tenantId)) return true;       // explicit allowlist
  if (flag.rolloutPct >= 100) return true;
  if (flag.rolloutPct <= 0) return false;
  return bucket(`${key}:${ctx.tenantId ?? ctx.userId ?? 'anon'}`) < flag.rolloutPct;
}
