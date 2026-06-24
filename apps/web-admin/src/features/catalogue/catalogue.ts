// apps/web-admin/src/features/catalogue/catalogue.ts · PURE, framework-free helpers + types for the god-mode
// PLATFORM master-taxonomy registry. No fetch, no React → unit-tested. MIRRORS admin-api global-catalogue-ops:
// two registries — controlled-vocabulary lookups (lookup_types + platform lookup_values) and the 5-level
// category tree. Codes/slugs/names are charset+length-bounded exactly as the zod DTO; sortOrder/minAge are
// float-free integer parses; meta is a JSON object of bounded primitives. NO money path.

export const COMMERCE_KINDS = ['goods', 'livestock', 'service', 'rental', 'course', 'input_regulated'] as const;
export type CommerceKind = (typeof COMMERCE_KINDS)[number];

const TYPE_CODE_RE = /^[a-z][a-z0-9_]{1,59}$/;     // lookup type code (2..60)
const VALUE_CODE_RE = /^[a-z0-9][a-z0-9_.-]{0,79}$/; // lookup value code (1..80)
const SLUG_RE = /^[a-z0-9_]{1,40}$/;               // category slug (one ltree label)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SORT_MAX = 32767;
const MIN_AGE_MAX = 120;

export function isUuid(v: string | null | undefined): boolean { return UUID_RE.test((v ?? '').trim()); }
export function validReason(r: string | null | undefined): boolean { const v = (r ?? '').trim(); return v.length >= 3 && v.length <= 1000; }
export function validName(n: string | null | undefined, max = 150): boolean { const v = (n ?? '').trim(); return v.length >= 1 && v.length <= max; }
export function isCommerceKind(k: string | null | undefined): k is CommerceKind { return (COMMERCE_KINDS as readonly string[]).includes(k ?? ''); }
export function commerceKindKey(k: string | null | undefined): CommerceKind { return isCommerceKind(k) ? k : 'goods'; }

// float-free integer parse for a 1..5-digit string within [0,max]; '' → fallback.
function intInRange(raw: string | undefined, max: number, fallback: number | null): number | null | undefined {
  const s = (raw ?? '').trim();
  if (!s) return fallback;
  if (!/^[0-9]{1,5}$/.test(s)) return undefined;   // undefined = invalid
  const n = +s;
  return n >= 0 && n <= max ? n : undefined;
}
export function parseSortOrder(raw: string | undefined): number | undefined {
  const v = intInRange(raw, SORT_MAX, 100);   // default 100
  return v === null ? undefined : v;
}

export type MetaResult = { ok: true; value: Record<string, unknown> } | { ok: false };
/** Parse the meta JSON: must be a plain object whose values are primitives or arrays of primitives. '' → {}. */
export function parseMeta(raw: string | undefined): MetaResult {
  const s = (raw ?? '').trim();
  if (!s) return { ok: true, value: {} };
  let parsed: unknown;
  try { parsed = JSON.parse(s); } catch { return { ok: false }; }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return { ok: false };
  const okPrim = (v: unknown) => v === null || ['string', 'number', 'boolean'].includes(typeof v);
  for (const v of Object.values(parsed as Record<string, unknown>)) {
    if (Array.isArray(v)) { if (!v.every(okPrim)) return { ok: false }; }
    else if (!okPrim(v)) return { ok: false };
  }
  return { ok: true, value: parsed as Record<string, unknown> };
}

/* ===================== lookup types ===================== */
export type CreateTypeResult = { ok: true; value: { code: string; defaultName: string; isTenantExtendable: boolean; reason: string } } | { ok: false; error: 'code' | 'defaultName' | 'reason' };
export function buildCreateType(raw: { code?: string; defaultName?: string; isTenantExtendable?: string; reason?: string }): CreateTypeResult {
  const code = (raw.code ?? '').trim();
  if (!TYPE_CODE_RE.test(code)) return { ok: false, error: 'code' };
  if (!validName(raw.defaultName, 100)) return { ok: false, error: 'defaultName' };
  if (!validReason(raw.reason)) return { ok: false, error: 'reason' };
  return { ok: true, value: { code, defaultName: (raw.defaultName ?? '').trim(), isTenantExtendable: raw.isTenantExtendable === 'true', reason: (raw.reason ?? '').trim() } };
}
export type UpdateTypeResult = { ok: true; value: { defaultName: string; reason: string } } | { ok: false; error: 'defaultName' | 'reason' };
export function buildUpdateType(raw: { defaultName?: string; reason?: string }): UpdateTypeResult {
  if (!validName(raw.defaultName, 100)) return { ok: false, error: 'defaultName' };
  if (!validReason(raw.reason)) return { ok: false, error: 'reason' };
  return { ok: true, value: { defaultName: (raw.defaultName ?? '').trim(), reason: (raw.reason ?? '').trim() } };
}

/* ===================== lookup values ===================== */
export type CreateValueResult = { ok: true; value: { typeCode: string; code: string; defaultName: string; meta: Record<string, unknown>; sortOrder: number; reason: string } } | { ok: false; error: 'typeCode' | 'code' | 'defaultName' | 'meta' | 'sortOrder' | 'reason' };
export function buildCreateValue(raw: { typeCode?: string; code?: string; defaultName?: string; meta?: string; sortOrder?: string; reason?: string }): CreateValueResult {
  const typeCode = (raw.typeCode ?? '').trim();
  if (!TYPE_CODE_RE.test(typeCode)) return { ok: false, error: 'typeCode' };
  const code = (raw.code ?? '').trim();
  if (!VALUE_CODE_RE.test(code)) return { ok: false, error: 'code' };
  if (!validName(raw.defaultName)) return { ok: false, error: 'defaultName' };
  const meta = parseMeta(raw.meta);
  if (!meta.ok) return { ok: false, error: 'meta' };
  const sortOrder = parseSortOrder(raw.sortOrder);
  if (sortOrder === undefined) return { ok: false, error: 'sortOrder' };
  if (!validReason(raw.reason)) return { ok: false, error: 'reason' };
  return { ok: true, value: { typeCode, code, defaultName: (raw.defaultName ?? '').trim(), meta: meta.value, sortOrder, reason: (raw.reason ?? '').trim() } };
}
export type UpdateValueResult = { ok: true; value: { defaultName: string; meta: Record<string, unknown>; sortOrder: number; reason: string } } | { ok: false; error: 'defaultName' | 'meta' | 'sortOrder' | 'reason' };
export function buildUpdateValue(raw: { defaultName?: string; meta?: string; sortOrder?: string; reason?: string }): UpdateValueResult {
  if (!validName(raw.defaultName)) return { ok: false, error: 'defaultName' };
  const meta = parseMeta(raw.meta);
  if (!meta.ok) return { ok: false, error: 'meta' };
  const sortOrder = parseSortOrder(raw.sortOrder);
  if (sortOrder === undefined) return { ok: false, error: 'sortOrder' };
  if (!validReason(raw.reason)) return { ok: false, error: 'reason' };
  return { ok: true, value: { defaultName: (raw.defaultName ?? '').trim(), meta: meta.value, sortOrder, reason: (raw.reason ?? '').trim() } };
}

export type SetActiveResult = { ok: true; value: { isActive: boolean; reason: string } } | { ok: false; error: 'isActive' | 'reason' };
export function buildSetActive(raw: { isActive?: string; reason?: string }): SetActiveResult {
  const v = (raw.isActive ?? '').trim();
  if (v !== 'true' && v !== 'false') return { ok: false, error: 'isActive' };
  if (!validReason(raw.reason)) return { ok: false, error: 'reason' };
  return { ok: true, value: { isActive: v === 'true', reason: (raw.reason ?? '').trim() } };
}

/* ===================== categories ===================== */
export type CreateCategoryResult = { ok: true; value: { parentId: string | null; slug: string; defaultName: string; commerceKind: CommerceKind; requiresLicense: boolean; requiresCertificate: boolean; minAge: number | null; sortOrder: number; iconMediaId: string | null; reason: string } } | { ok: false; error: 'parentId' | 'slug' | 'defaultName' | 'commerceKind' | 'minAge' | 'sortOrder' | 'iconMediaId' | 'reason' };
export function buildCreateCategory(raw: { parentId?: string; slug?: string; defaultName?: string; commerceKind?: string; requiresLicense?: string; requiresCertificate?: string; minAge?: string; sortOrder?: string; iconMediaId?: string; reason?: string }): CreateCategoryResult {
  const parent = (raw.parentId ?? '').trim();
  if (parent && !isUuid(parent)) return { ok: false, error: 'parentId' };
  if (!SLUG_RE.test((raw.slug ?? '').trim())) return { ok: false, error: 'slug' };
  if (!validName(raw.defaultName)) return { ok: false, error: 'defaultName' };
  const commerceKind = (raw.commerceKind ?? 'goods').trim();
  if (!isCommerceKind(commerceKind)) return { ok: false, error: 'commerceKind' };
  const minAge = intInRange(raw.minAge, MIN_AGE_MAX, null);
  if (minAge === undefined) return { ok: false, error: 'minAge' };
  const sortOrder = parseSortOrder(raw.sortOrder);
  if (sortOrder === undefined) return { ok: false, error: 'sortOrder' };
  const icon = (raw.iconMediaId ?? '').trim();
  if (icon && !isUuid(icon)) return { ok: false, error: 'iconMediaId' };
  if (!validReason(raw.reason)) return { ok: false, error: 'reason' };
  return { ok: true, value: { parentId: parent || null, slug: (raw.slug ?? '').trim(), defaultName: (raw.defaultName ?? '').trim(), commerceKind, requiresLicense: raw.requiresLicense === 'true', requiresCertificate: raw.requiresCertificate === 'true', minAge, sortOrder, iconMediaId: icon || null, reason: (raw.reason ?? '').trim() } };
}
export type UpdateCategoryResult = { ok: true; value: { defaultName: string; commerceKind: CommerceKind; requiresLicense: boolean; requiresCertificate: boolean; minAge: number | null; sortOrder: number; iconMediaId: string | null; reason: string } } | { ok: false; error: 'defaultName' | 'commerceKind' | 'minAge' | 'sortOrder' | 'iconMediaId' | 'reason' };
export function buildUpdateCategory(raw: { defaultName?: string; commerceKind?: string; requiresLicense?: string; requiresCertificate?: string; minAge?: string; sortOrder?: string; iconMediaId?: string; reason?: string }): UpdateCategoryResult {
  if (!validName(raw.defaultName)) return { ok: false, error: 'defaultName' };
  const commerceKind = (raw.commerceKind ?? '').trim();
  if (!isCommerceKind(commerceKind)) return { ok: false, error: 'commerceKind' };
  const minAge = intInRange(raw.minAge, MIN_AGE_MAX, null);
  if (minAge === undefined) return { ok: false, error: 'minAge' };
  const sortOrder = parseSortOrder(raw.sortOrder);
  if (sortOrder === undefined) return { ok: false, error: 'sortOrder' };
  const icon = (raw.iconMediaId ?? '').trim();
  if (icon && !isUuid(icon)) return { ok: false, error: 'iconMediaId' };
  if (!validReason(raw.reason)) return { ok: false, error: 'reason' };
  return { ok: true, value: { defaultName: (raw.defaultName ?? '').trim(), commerceKind, requiresLicense: raw.requiresLicense === 'true', requiresCertificate: raw.requiresCertificate === 'true', minAge, sortOrder, iconMediaId: icon || null, reason: (raw.reason ?? '').trim() } };
}
export type MoveResult = { ok: true; value: { newParentId: string | null; reason: string } } | { ok: false; error: 'newParentId' | 'reason' };
export function buildMove(raw: { newParentId?: string; reason?: string }): MoveResult {
  const np = (raw.newParentId ?? '').trim();
  if (np && !isUuid(np)) return { ok: false, error: 'newParentId' };
  if (!validReason(raw.reason)) return { ok: false, error: 'reason' };
  return { ok: true, value: { newParentId: np || null, reason: (raw.reason ?? '').trim() } };
}

// ---- read-model shapes (mirror admin-api read models; type-only, no runtime) ----
export interface LookupTypeRow { code: string; defaultName: string; isTenantExtendable: boolean }
export interface LookupValueRow { id: string; typeCode: string; code: string; defaultName: string; meta: Record<string, unknown>; sortOrder: number; isActive: boolean; createdAt: string | null }
export interface CategoryRow { id: string; parentId: string | null; code: string; defaultName: string; path: string; depth: number; commerceKind: CommerceKind | string; requiresLicense: boolean; requiresCertificate: boolean; minAge: number | null; isActive: boolean; sortOrder: number; iconMediaId: string | null; createdAt: string | null }
export interface CatalogueChangeRow { id: string; entityType: string; entityId: string; action: string; oldValue: unknown; newValue: unknown; reason: string; actorUserId: string; createdAt: string | null }
