// apps/web-admin/src/features/schemes-registry/scheme.ts · PURE, framework-free helpers + types for the god-mode
// government-scheme MASTER registry. No fetch, no React → unit-tested. MIRRORS admin-api schemes-registry-ops:
// authorities (issuing bodies) + the code-keyed, versioned schemes catalogue. Codes/names/URLs are charset-bounded
// plain text (no HTML), the JSON blobs are non-empty objects, the application window is {opens,closes,season?} as
// 'MM-DD', and processing_fee_minor is a bigint MINOR-UNIT digit STRING (Law 2 — never a float).

export const AUTHORITY_LEVELS = ['central', 'state', 'district', 'body'] as const;
export type AuthorityLevel = (typeof AUTHORITY_LEVELS)[number];
export function authorityLevelKey(l: string | null | undefined): AuthorityLevel {
  return (AUTHORITY_LEVELS as readonly string[]).includes(l ?? '') ? (l as AuthorityLevel) : 'body';
}
export function isAuthorityLevel(l: string | null | undefined): l is AuthorityLevel {
  return (AUTHORITY_LEVELS as readonly string[]).includes(l ?? '');
}

const CODE_RE = /^[a-z][a-z0-9_]{1,59}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MMDD_RE = /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
const SEASON_RE = /^[a-z_]{1,20}$/;
const FEE_RE = /^[0-9]{1,15}$/;

export function isUuid(v: string | null | undefined): boolean { return UUID_RE.test((v ?? '').trim()); }
export function validReason(r: string | null | undefined): boolean { const v = (r ?? '').trim(); return v.length >= 3 && v.length <= 1000; }
export function isMmDd(v: string | null | undefined): boolean { return MMDD_RE.test((v ?? '').trim()); }
// plain text (no angle brackets), trimmed, 1..max
export function validName(n: string | null | undefined, max: number): boolean {
  const v = (n ?? '').trim();
  return v.length >= 1 && v.length <= max && !/[<>]/.test(v);
}

/** Comma/space-separated UUID list → de-duped array, or error if any token isn't a UUID. */
export type UuidListResult = { ok: true; value: string[] } | { ok: false };
export function parseUuidList(raw: string | undefined): UuidListResult {
  const items = Array.from(new Set((raw ?? '').split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)));
  if (!items.every((i) => UUID_RE.test(i))) return { ok: false };
  return { ok: true, value: items };
}

/** A non-empty JSON object (benefit_summary / eligibility_rules). '' → error (these are NOT NULL non-empty). */
export type JsonObjResult = { ok: true; value: Record<string, unknown> } | { ok: false };
export function parseJsonObject(raw: string | undefined): JsonObjResult {
  const s = (raw ?? '').trim();
  if (!s) return { ok: false };
  let parsed: unknown;
  try { parsed = JSON.parse(s); } catch { return { ok: false }; }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return { ok: false };
  if (Object.keys(parsed as Record<string, unknown>).length === 0) return { ok: false };
  return { ok: true, value: parsed as Record<string, unknown> };
}

/** Minor-unit fee: a non-negative integer digit string (≤15). '' → '0'. Never a float (Law 2). */
export function parseFeeMinor(raw: string | undefined): string | null {
  const s = (raw ?? '').trim();
  if (!s) return '0';
  return FEE_RE.test(s) ? s : null;   // null = invalid
}

export function buildSourceUrl(raw: string | undefined): { ok: true; value: string | null } | { ok: false } {
  const s = (raw ?? '').trim();
  if (!s) return { ok: true, value: null };
  if (s.length > 400) return { ok: false };
  try { const u = new URL(s); if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false }; }
  catch { return { ok: false }; }
  return { ok: true, value: s };
}

export type Window = { opens: string; closes: string; season?: string };
/** opens+closes both present → a window; both blank → null; only one present (or bad MM-DD/season) → error. */
export function buildWindow(raw: { opens?: string; closes?: string; season?: string }): { ok: true; value: Window | null } | { ok: false } {
  const opens = (raw.opens ?? '').trim();
  const closes = (raw.closes ?? '').trim();
  const season = (raw.season ?? '').trim();
  if (!opens && !closes) return { ok: true, value: null };
  if (!isMmDd(opens) || !isMmDd(closes)) return { ok: false };
  if (season && !SEASON_RE.test(season)) return { ok: false };
  return { ok: true, value: { opens, closes, ...(season ? { season } : {}) } };
}

/* ===================== authorities ===================== */
export type CreateAuthorityResult = { ok: true; value: { defaultName: string; level: AuthorityLevel; regionId: string | null; reason: string } } | { ok: false; error: 'defaultName' | 'level' | 'regionId' | 'reason' };
export function buildCreateAuthority(raw: { defaultName?: string; level?: string; regionId?: string; reason?: string }): CreateAuthorityResult {
  if (!validName(raw.defaultName, 200)) return { ok: false, error: 'defaultName' };
  if (!isAuthorityLevel(raw.level)) return { ok: false, error: 'level' };
  const region = (raw.regionId ?? '').trim();
  if (region && !isUuid(region)) return { ok: false, error: 'regionId' };
  if (!validReason(raw.reason)) return { ok: false, error: 'reason' };
  return { ok: true, value: { defaultName: (raw.defaultName ?? '').trim(), level: raw.level as AuthorityLevel, regionId: region || null, reason: (raw.reason ?? '').trim() } };
}
export type UpdateAuthorityResult = { ok: true; value: { defaultName: string; level: AuthorityLevel; regionId: string | null; reason: string } } | { ok: false; error: 'defaultName' | 'level' | 'regionId' | 'reason' };
export function buildUpdateAuthority(raw: { defaultName?: string; level?: string; regionId?: string; reason?: string }): UpdateAuthorityResult {
  // The edit form always re-sends all three fields (≥1-required refine is trivially satisfied).
  return buildCreateAuthority(raw);
}

/* ===================== schemes ===================== */
export type CreateSchemeResult =
  | { ok: true; value: { code: string; defaultName: string; authorityId: string; categoryId: string; benefitSummary: Record<string, unknown>; eligibilityRules: Record<string, unknown>; requiredDocTypeIds: string[]; applicationWindow: Window | null; applicableRegionIds: string[]; processingFeeMinor: string; sourceUrl: string | null; reason: string } }
  | { ok: false; error: 'code' | 'defaultName' | 'authorityId' | 'categoryId' | 'benefitSummary' | 'eligibilityRules' | 'requiredDocTypeIds' | 'applicableRegionIds' | 'window' | 'processingFeeMinor' | 'sourceUrl' | 'reason' };
export function buildCreateScheme(raw: { code?: string; defaultName?: string; authorityId?: string; categoryId?: string; benefitSummary?: string; eligibilityRules?: string; requiredDocTypeIds?: string; applicationWindow_opens?: string; applicationWindow_closes?: string; applicationWindow_season?: string; applicableRegionIds?: string; processingFeeMinor?: string; sourceUrl?: string; reason?: string }): CreateSchemeResult {
  if (!CODE_RE.test((raw.code ?? '').trim())) return { ok: false, error: 'code' };
  if (!validName(raw.defaultName, 250)) return { ok: false, error: 'defaultName' };
  if (!isUuid(raw.authorityId)) return { ok: false, error: 'authorityId' };
  if (!isUuid(raw.categoryId)) return { ok: false, error: 'categoryId' };
  const benefit = parseJsonObject(raw.benefitSummary);
  if (!benefit.ok) return { ok: false, error: 'benefitSummary' };
  const elig = parseJsonObject(raw.eligibilityRules);
  if (!elig.ok) return { ok: false, error: 'eligibilityRules' };
  const docs = parseUuidList(raw.requiredDocTypeIds);
  if (!docs.ok) return { ok: false, error: 'requiredDocTypeIds' };
  const regions = parseUuidList(raw.applicableRegionIds);
  if (!regions.ok) return { ok: false, error: 'applicableRegionIds' };
  const window = buildWindow({ opens: raw.applicationWindow_opens, closes: raw.applicationWindow_closes, season: raw.applicationWindow_season });
  if (!window.ok) return { ok: false, error: 'window' };
  const fee = parseFeeMinor(raw.processingFeeMinor);
  if (fee === null) return { ok: false, error: 'processingFeeMinor' };
  const url = buildSourceUrl(raw.sourceUrl);
  if (!url.ok) return { ok: false, error: 'sourceUrl' };
  if (!validReason(raw.reason)) return { ok: false, error: 'reason' };
  return { ok: true, value: { code: (raw.code ?? '').trim(), defaultName: (raw.defaultName ?? '').trim(), authorityId: (raw.authorityId ?? '').trim(), categoryId: (raw.categoryId ?? '').trim(), benefitSummary: benefit.value, eligibilityRules: elig.value, requiredDocTypeIds: docs.value, applicationWindow: window.value, applicableRegionIds: regions.value, processingFeeMinor: fee, sourceUrl: url.value, reason: (raw.reason ?? '').trim() } };
}

export type UpdateMetaResult = { ok: true; value: { defaultName: string; authorityId: string; categoryId: string; sourceUrl: string | null; reason: string } } | { ok: false; error: 'defaultName' | 'authorityId' | 'categoryId' | 'sourceUrl' | 'reason' };
export function buildUpdateMeta(raw: { defaultName?: string; authorityId?: string; categoryId?: string; sourceUrl?: string; reason?: string }): UpdateMetaResult {
  if (!validName(raw.defaultName, 250)) return { ok: false, error: 'defaultName' };
  if (!isUuid(raw.authorityId)) return { ok: false, error: 'authorityId' };
  if (!isUuid(raw.categoryId)) return { ok: false, error: 'categoryId' };
  const url = buildSourceUrl(raw.sourceUrl);
  if (!url.ok) return { ok: false, error: 'sourceUrl' };
  if (!validReason(raw.reason)) return { ok: false, error: 'reason' };
  return { ok: true, value: { defaultName: (raw.defaultName ?? '').trim(), authorityId: (raw.authorityId ?? '').trim(), categoryId: (raw.categoryId ?? '').trim(), sourceUrl: url.value, reason: (raw.reason ?? '').trim() } };
}

export type UpdateRulesResult = { ok: true; value: { benefitSummary: Record<string, unknown>; eligibilityRules: Record<string, unknown>; requiredDocTypeIds: string[]; applicableRegionIds: string[]; processingFeeMinor: string; reason: string } } | { ok: false; error: 'benefitSummary' | 'eligibilityRules' | 'requiredDocTypeIds' | 'applicableRegionIds' | 'processingFeeMinor' | 'reason' };
export function buildUpdateRules(raw: { benefitSummary?: string; eligibilityRules?: string; requiredDocTypeIds?: string; applicableRegionIds?: string; processingFeeMinor?: string; reason?: string }): UpdateRulesResult {
  const benefit = parseJsonObject(raw.benefitSummary);
  if (!benefit.ok) return { ok: false, error: 'benefitSummary' };
  const elig = parseJsonObject(raw.eligibilityRules);
  if (!elig.ok) return { ok: false, error: 'eligibilityRules' };
  const docs = parseUuidList(raw.requiredDocTypeIds);
  if (!docs.ok) return { ok: false, error: 'requiredDocTypeIds' };
  const regions = parseUuidList(raw.applicableRegionIds);
  if (!regions.ok) return { ok: false, error: 'applicableRegionIds' };
  const fee = parseFeeMinor(raw.processingFeeMinor);
  if (fee === null) return { ok: false, error: 'processingFeeMinor' };
  if (!validReason(raw.reason)) return { ok: false, error: 'reason' };
  return { ok: true, value: { benefitSummary: benefit.value, eligibilityRules: elig.value, requiredDocTypeIds: docs.value, applicableRegionIds: regions.value, processingFeeMinor: fee, reason: (raw.reason ?? '').trim() } };
}

export type SetWindowResult = { ok: true; value: { applicationWindow: Window | null; reason: string } } | { ok: false; error: 'window' | 'reason' };
export function buildSetWindow(raw: { opens?: string; closes?: string; season?: string; reason?: string }): SetWindowResult {
  const window = buildWindow(raw);
  if (!window.ok) return { ok: false, error: 'window' };
  if (!validReason(raw.reason)) return { ok: false, error: 'reason' };
  return { ok: true, value: { applicationWindow: window.value, reason: (raw.reason ?? '').trim() } };
}

export type SetActiveResult = { ok: true; value: { isActive: boolean; reason: string } } | { ok: false; error: 'isActive' | 'reason' };
export function buildSetActive(raw: { isActive?: string; reason?: string }): SetActiveResult {
  const v = (raw.isActive ?? '').trim();
  if (v !== 'true' && v !== 'false') return { ok: false, error: 'isActive' };
  if (!validReason(raw.reason)) return { ok: false, error: 'reason' };
  return { ok: true, value: { isActive: v === 'true', reason: (raw.reason ?? '').trim() } };
}

// ---- read-model shapes (mirror admin-api read models; type-only, no runtime) ----
export interface AuthorityRow { id: string; defaultName: string; level: AuthorityLevel | string; regionId: string | null; createdAt: string | null }
export interface SchemeRow {
  id: string; code: string; defaultName: string; authorityId: string; categoryId: string;
  benefitSummary: Record<string, unknown>; eligibilityRules: Record<string, unknown>; requiredDocTypeIds: string[];
  applicationWindow: Window | null; applicableRegionIds: string[]; processingFeeMinor: string; sourceUrl: string | null;
  version: number; isActive: boolean; createdAt: string | null;
}
export interface SchemeChangeRow { id: string; entityType: string; entityId: string; action: string; oldValue: unknown; newValue: unknown; reason: string; actorUserId: string; createdAt: string | null }
