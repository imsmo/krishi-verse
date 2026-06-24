// apps/web-admin/src/features/flags/flag.ts · PURE, framework-free helpers + types for the god-mode feature-flag
// console. No fetch, no React → unit-tested. The legal-action logic MIRRORS admin-api's flag.entity (Law 10): a
// kill-switch-LOCKED flag refuses enable / set-rollout / set-targeting until explicitly unlocked; kill is always
// available; disable only reduces exposure. The builders mirror the zod DTO (FlagKey regex, rolloutPct 0..100 int,
// bounded targeting allowlists, mandatory audit reason) — all validation is exact + float-free.

const FLAG_KEY_RE = /^[a-z][a-z0-9_.]{1,79}$/;
const PLAN_RE = /^[a-z0-9_]{1,40}$/;
const COUNTRY_RE = /^[A-Z]{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLLOUT_RE = /^(0|[1-9]\d?|100)$/; // integer 0..100, no leading zeros / floats
// admin-api bounds (domain/rollout.ts)
const MAX_TENANT_IDS = 1000, MAX_PLANS = 200, MAX_COUNTRIES = 300;

export interface TargetingRules { tenant_ids?: string[]; plans?: string[]; countries?: string[] }
export interface FlagRow { key: string; description: string | null; isEnabled: boolean; rolloutPct: number; rules: TargetingRules; isLocked: boolean; createdAt: string | null }
export interface FlagChange { id: string; flagKey: string; action: string; oldValue: unknown; newValue: unknown; reason: string; actorUserId: string; createdAt: string }

/** A flag's display state, for the badge + i18n key. */
export type FlagState = 'locked' | 'on' | 'off';
export function flagState(f: Pick<FlagRow, 'isEnabled' | 'isLocked'>): FlagState {
  if (f.isLocked) return 'locked';
  return f.isEnabled ? 'on' : 'off';
}

// ---- legal actions (mirror flag.entity invariants) ----
export function canEnable(f: Pick<FlagRow, 'isEnabled' | 'isLocked'>): boolean { return !f.isLocked && !f.isEnabled; }
export function canDisable(f: Pick<FlagRow, 'isEnabled' | 'isLocked'>): boolean { return !f.isLocked && f.isEnabled; }
export function canSetRollout(f: Pick<FlagRow, 'isLocked'>): boolean { return !f.isLocked; }
export function canSetTargeting(f: Pick<FlagRow, 'isLocked'>): boolean { return !f.isLocked; }
export function canKill(f: Pick<FlagRow, 'isLocked'>): boolean { return !f.isLocked; }
export function canUnlock(f: Pick<FlagRow, 'isLocked'>): boolean { return f.isLocked; }

function validReason(r: string | undefined): boolean { const v = (r ?? '').trim(); return v.length >= 3 && v.length <= 1000; }

/** Parse a comma/whitespace-separated list → trimmed non-empty tokens. */
function tokens(raw: string | undefined): string[] {
  return (raw ?? '').split(/[\s,]+/).map((t) => t.trim()).filter(Boolean);
}

export type TargetingResult =
  | { ok: true; value: { tenantIds: string[]; plans: string[]; countries: string[] } }
  | { ok: false; error: 'tenantIds' | 'plans' | 'countries' };

/** Validate + assemble targeting allowlists from comma-separated inputs (bounded; charset-checked). */
export function buildTargeting(raw: { tenantIds?: string; plans?: string; countries?: string }): TargetingResult {
  const tenantIds = tokens(raw.tenantIds);
  if (tenantIds.length > MAX_TENANT_IDS || tenantIds.some((t) => !UUID_RE.test(t))) return { ok: false, error: 'tenantIds' };
  const plans = tokens(raw.plans);
  if (plans.length > MAX_PLANS || plans.some((p) => !PLAN_RE.test(p))) return { ok: false, error: 'plans' };
  const countries = tokens(raw.countries).map((c) => c.toUpperCase());
  if (countries.length > MAX_COUNTRIES || countries.some((c) => !COUNTRY_RE.test(c))) return { ok: false, error: 'countries' };
  return { ok: true, value: { tenantIds, plans, countries } };
}

export type RolloutResult = { ok: true; value: number } | { ok: false; error: 'rolloutPct' };
/** Parse a rollout percentage as an INTEGER 0..100 (float-free). */
export function parseRolloutPct(raw: string | undefined): RolloutResult {
  const v = (raw ?? '').trim();
  if (!ROLLOUT_RE.test(v)) return { ok: false, error: 'rolloutPct' };
  return { ok: true, value: +v }; // safe: v matched ROLLOUT_RE (digits only), float-free
}

export type CreateFlagResult =
  | { ok: true; value: { key: string; description?: string; rolloutPct: number; tenantIds: string[]; plans: string[]; countries: string[]; reason: string } }
  | { ok: false; error: 'key' | 'rolloutPct' | 'reason' | 'tenantIds' | 'plans' | 'countries' };

/** Validate + assemble the POST /flags body (defaults OFF / 0% per Law 10). */
export function buildCreateFlag(raw: { key?: string; description?: string; rolloutPct?: string; reason?: string; tenantIds?: string; plans?: string; countries?: string }): CreateFlagResult {
  const key = (raw.key ?? '').trim();
  if (!FLAG_KEY_RE.test(key)) return { ok: false, error: 'key' };
  const pct = parseRolloutPct(raw.rolloutPct ?? '0');
  if (!pct.ok) return { ok: false, error: 'rolloutPct' };
  if (!validReason(raw.reason)) return { ok: false, error: 'reason' };
  const targ = buildTargeting(raw);
  if (!targ.ok) return targ;
  const description = (raw.description ?? '').trim();
  return {
    ok: true,
    value: {
      key, rolloutPct: pct.value, reason: (raw.reason ?? '').trim(),
      tenantIds: targ.value.tenantIds, plans: targ.value.plans, countries: targ.value.countries,
      ...(description ? { description } : {}),
    },
  };
}

export { validReason as validFlagReason };
