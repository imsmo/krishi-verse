// apps/web-admin/src/features/tenants/tenant.ts · PURE, framework-free helpers + types for the god-mode tenants
// console. No fetch, no React → unit-tested. The state machine MIRRORS admin-api's tenant.state.ts (Law 5 — the
// server is authoritative; this only decides which lifecycle actions to SHOW, and a raced/illegal move degrades
// to a 409 message). The limit-override validator mirrors the admin-api zod DTO (integer-string, -1 = unlimited)
// and is FLOAT-FREE (digit-string only). Money/usage are rendered by the caller via formatMoneyMinor.

export const TENANT_STATUSES = ['pending', 'trial', 'active', 'grace', 'suspended', 'archived', 'terminated'] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

// Mirrors admin-api tenant.state TRANSITIONS exactly.
const TRANSITIONS: Readonly<Record<TenantStatus, readonly TenantStatus[]>> = {
  pending: ['trial', 'active', 'archived', 'terminated'],
  trial: ['active', 'grace', 'suspended', 'archived', 'terminated'],
  active: ['grace', 'suspended', 'archived', 'terminated'],
  grace: ['active', 'suspended', 'archived', 'terminated'],
  suspended: ['active', 'archived', 'terminated'],
  archived: ['terminated'],
  terminated: [],
};

export function canTransition(from: TenantStatus, to: TenantStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}
export function isLive(s: TenantStatus): boolean { return s === 'trial' || s === 'active' || s === 'grace'; }
export function isTerminal(s: TenantStatus): boolean { return s === 'terminated'; }

/** Approve is valid only for a pending/trial tenant (mirrors Tenant.approve in admin-api). */
export function canApprove(s: TenantStatus): boolean { return s === 'pending' || s === 'trial'; }
/** Suspend is valid from the live states. */
export function canSuspend(s: TenantStatus): boolean { return canTransition(s, 'suspended'); }
/** Archive is valid from any non-terminal, non-archived state. */
export function canArchive(s: TenantStatus): boolean { return canTransition(s, 'archived'); }

/** i18n sub-key for a status badge, guarding an unexpected server value. */
export function statusKey(s: string | null | undefined): TenantStatus {
  return (TENANT_STATUSES as readonly string[]).includes(s ?? '') ? (s as TenantStatus) : 'pending';
}

// ---- read-model shapes (mirror admin-api tenant-ops read models; type-only, no runtime) ----
export interface TenantListItem { id: string; slug: string; status: TenantStatus; riskScore: number; approvedAt: string | null; createdAt: string | null; }
export interface TenantScorecard {
  tenant: TenantListItem;
  subscription: { planId: string; status: string; priceMinor: string; currency: string; periodEnd: string } | null;
  liveListings: number;
  openDisputes: number;
  limitOverrides: { limitCode: string; limitValue: string; expiresAt: string | null }[];
}

// ---- limit-override form (mirrors admin-api OverrideLimitSchema; float-free) ----
const LIMIT_CODE_RE = /^[a-z0-9_]{2,60}$/;
const LIMIT_VALUE_RE = /^-1$|^\d{1,18}$/; // integer string; -1 = unlimited; no floats
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

export type LimitOverrideResult =
  | { ok: true; value: { limitCode: string; limitValue: string; reason: string; expiresAt?: string } }
  | { ok: false; error: 'limitCode' | 'limitValue' | 'reason' | 'expiresAt' };

/** Validate + assemble the PATCH /tenants/:id/limits body. limitValue stays a STRING (never floated); a blank
 *  expiry is omitted (null/unlimited handled server-side). Reason is mandatory (audit, §4). */
export function buildLimitOverride(raw: { limitCode?: string; limitValue?: string; reason?: string; expiresAt?: string }): LimitOverrideResult {
  const limitCode = (raw.limitCode ?? '').trim();
  if (!LIMIT_CODE_RE.test(limitCode)) return { ok: false, error: 'limitCode' };

  const limitValue = (raw.limitValue ?? '').trim();
  if (!LIMIT_VALUE_RE.test(limitValue)) return { ok: false, error: 'limitValue' };

  const reason = (raw.reason ?? '').trim();
  if (reason.length < 3 || reason.length > 500) return { ok: false, error: 'reason' };

  const expiresRaw = (raw.expiresAt ?? '').trim();
  let expiresAt: string | undefined;
  if (expiresRaw) {
    if (!ISO_DATETIME_RE.test(expiresRaw) || Number.isNaN(Date.parse(expiresRaw))) return { ok: false, error: 'expiresAt' };
    expiresAt = new Date(expiresRaw).toISOString();
  }
  return { ok: true, value: { limitCode, limitValue, reason, ...(expiresAt ? { expiresAt } : {}) } };
}

/** Validate the mandatory audit reason for a lifecycle mutation (approve/suspend/archive). */
export function validReason(reason: string | null | undefined): boolean {
  const r = (reason ?? '').trim();
  return r.length >= 3 && r.length <= 500;
}
