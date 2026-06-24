// apps/web-admin/src/features/plans/plan.ts · PURE, framework-free helpers + types for the god-mode SaaS plan-
// catalogue console. No fetch, no React → unit-tested. The lifecycle state machine MIRRORS admin-api's plan.state
// (Law 5). MONEY is a bigint MINOR-UNIT STRING end-to-end — every price field is validated as a non-negative
// integer string (digits only, ≤15) and passed through; NEVER parsed to a float (Law 2). A limit value is the
// string '-1' (unlimited) or a non-negative integer (≤18 digits). Rendered by the caller via formatMoneyMinor.

export const PLAN_STATUSES = ['draft', 'active', 'archived'] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

// Mirrors admin-api plan.state TRANSITIONS exactly.
const TRANSITIONS: Readonly<Record<PlanStatus, readonly PlanStatus[]>> = {
  draft: ['active', 'archived'],
  active: ['archived'],
  archived: ['active'],
};
export function canTransition(from: PlanStatus, to: PlanStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}
export function isActiveStatus(s: PlanStatus): boolean { return s === 'active'; }

// The three lifecycle actions (PATCH :id {action}) surfaced only when legal.
export function canPublish(s: PlanStatus): boolean { return s === 'draft'; }                  // draft → active
export function canArchive(s: PlanStatus): boolean { return canTransition(s, 'archived'); }    // draft|active → archived
export function canReactivate(s: PlanStatus): boolean { return s === 'archived'; }             // archived → active

export function planStatusKey(s: string | null | undefined): PlanStatus {
  return (PLAN_STATUSES as readonly string[]).includes(s ?? '') ? (s as PlanStatus) : 'draft';
}

const PLAN_CODE_RE = /^[a-z0-9_]{2,40}$/;
const COUNTRY_RE = /^[A-Z]{2}$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
const MINOR_RE = /^[0-9]{1,15}$/;          // non-negative integer minor units (mirrors zod MinorUnits) — float-free
const LIMIT_RE = /^(-1|[0-9]{1,18})$/;     // -1 = unlimited, else non-negative integer
const FEATURE_CODE_RE = /^[a-z0-9_.]{2,60}$/;

export function validReason(r: string | null | undefined): boolean {
  const v = (r ?? '').trim();
  return v.length >= 3 && v.length <= 1000;
}

// Shared price-triple validation (monthly/annual/setup as minor-unit strings; setup defaults to '0').
function prices(raw: { monthlyPriceMinor?: string; annualPriceMinor?: string; setupFeeMinor?: string }): { ok: true; value: { monthlyPriceMinor: string; annualPriceMinor: string; setupFeeMinor: string } } | { ok: false } {
  const m = (raw.monthlyPriceMinor ?? '').trim();
  const a = (raw.annualPriceMinor ?? '').trim();
  const s = (raw.setupFeeMinor ?? '').trim() || '0';
  if (!MINOR_RE.test(m) || !MINOR_RE.test(a) || !MINOR_RE.test(s)) return { ok: false };
  return { ok: true, value: { monthlyPriceMinor: m, annualPriceMinor: a, setupFeeMinor: s } };
}

export type CreatePlanResult =
  | { ok: true; value: { code: string; defaultName: string; countryCode: string; currencyCode: string; monthlyPriceMinor: string; annualPriceMinor: string; setupFeeMinor: string; isPublic: boolean; reason: string } }
  | { ok: false; error: 'code' | 'defaultName' | 'countryCode' | 'currencyCode' | 'price' | 'reason' };

export function buildCreatePlan(raw: { code?: string; defaultName?: string; countryCode?: string; currencyCode?: string; monthlyPriceMinor?: string; annualPriceMinor?: string; setupFeeMinor?: string; isPublic?: string; reason?: string }): CreatePlanResult {
  const code = (raw.code ?? '').trim();
  if (!PLAN_CODE_RE.test(code)) return { ok: false, error: 'code' };
  const defaultName = (raw.defaultName ?? '').trim();
  if (defaultName.length < 1 || defaultName.length > 100) return { ok: false, error: 'defaultName' };
  const countryCode = (raw.countryCode ?? '').trim().toUpperCase();
  if (!COUNTRY_RE.test(countryCode)) return { ok: false, error: 'countryCode' };
  const currencyCode = (raw.currencyCode ?? '').trim().toUpperCase();
  if (!CURRENCY_RE.test(currencyCode)) return { ok: false, error: 'currencyCode' };
  const p = prices(raw);
  if (!p.ok) return { ok: false, error: 'price' };
  if (!validReason(raw.reason)) return { ok: false, error: 'reason' };
  return { ok: true, value: { code, defaultName, countryCode, currencyCode, ...p.value, isPublic: raw.isPublic !== 'false', reason: (raw.reason ?? '').trim() } };
}

export type PricingResult =
  | { ok: true; value: { monthlyPriceMinor: string; annualPriceMinor: string; setupFeeMinor: string; reason: string } }
  | { ok: false; error: 'price' | 'reason' };

export function buildPricing(raw: { monthlyPriceMinor?: string; annualPriceMinor?: string; setupFeeMinor?: string; reason?: string }): PricingResult {
  const p = prices(raw);
  if (!p.ok) return { ok: false, error: 'price' };
  if (!validReason(raw.reason)) return { ok: false, error: 'reason' };
  return { ok: true, value: { ...p.value, reason: (raw.reason ?? '').trim() } };
}

export type VersionResult =
  | { ok: true; value: { monthlyPriceMinor: string; annualPriceMinor: string; setupFeeMinor: string; isPublic?: boolean; reason: string } }
  | { ok: false; error: 'price' | 'reason' };

export function buildVersion(raw: { monthlyPriceMinor?: string; annualPriceMinor?: string; setupFeeMinor?: string; isPublic?: string; reason?: string }): VersionResult {
  const p = prices(raw);
  if (!p.ok) return { ok: false, error: 'price' };
  if (!validReason(raw.reason)) return { ok: false, error: 'reason' };
  const isPublic = raw.isPublic === 'true' ? true : raw.isPublic === 'false' ? false : undefined;
  return { ok: true, value: { ...p.value, ...(isPublic === undefined ? {} : { isPublic }), reason: (raw.reason ?? '').trim() } };
}

export type SetLimitResult = { ok: true; value: { limitValue: string; reason: string } } | { ok: false; error: 'limitCode' | 'limitValue' | 'reason' };
export function buildSetLimit(raw: { limitCode?: string; limitValue?: string; reason?: string }): SetLimitResult {
  if (!FEATURE_CODE_RE.test((raw.limitCode ?? '').trim())) return { ok: false, error: 'limitCode' };
  if (!LIMIT_RE.test((raw.limitValue ?? '').trim())) return { ok: false, error: 'limitValue' };
  if (!validReason(raw.reason)) return { ok: false, error: 'reason' };
  return { ok: true, value: { limitValue: (raw.limitValue ?? '').trim(), reason: (raw.reason ?? '').trim() } };
}

/** Validate a feature code (path param) — guards against an invalid `:code` segment. */
export function validFeatureCode(code: string | null | undefined): boolean { return FEATURE_CODE_RE.test((code ?? '').trim()); }

// ---- read-model shapes (mirror admin-api plans-ops read models; type-only, no runtime) ----
export interface PlanRow { id: string; code: string; version: number; defaultName: string; countryCode: string; currency: string; monthlyPriceMinor: string; annualPriceMinor: string; setupFeeMinor: string; isPublic: boolean; isActive: boolean; status: PlanStatus; createdAt: string | null }
export interface PlanDetail extends PlanRow { features: { code: string; isIncluded: boolean; config: unknown }[]; limits: Record<string, string> }
export interface FeatureCatalogueItem { code: string; defaultName: string; moduleCode: string | null }
export interface PlanChange { id: string; planId: string; action: string; oldValue: unknown; newValue: unknown; reason: string; actorUserId: string; createdAt: string | null }
