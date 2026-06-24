// apps/web-admin/src/features/impersonation/grant.ts · PURE, framework-free helpers + types for the god-mode
// act-as (impersonation) console — the highest-sensitivity surface. No fetch, no React → unit-tested. MIRRORS
// admin-api impersonation: the grant lifecycle state machine (grant.state — active → ended|expired|revoked, only
// active is non-terminal), the deliberate safety bounds (READ-ONLY scope only, time-boxed ttl, ≥8-char
// justification). The minted act-as TOKEN is a secret handled server-side only — it is NEVER modelled, returned,
// or rendered here.

// Mirrors admin-api grant.state.ts.
export const GRANT_STATUSES = ['active', 'ended', 'expired', 'revoked'] as const;
export type GrantStatus = (typeof GRANT_STATUSES)[number];

export function grantStatusKey(s: string | null | undefined): GrantStatus {
  return (GRANT_STATUSES as readonly string[]).includes(s ?? '') ? (s as GrantStatus) : 'expired';
}
export function isGrantActive(s: GrantStatus): boolean { return s === 'active'; }
export function isGrantTerminal(s: GrantStatus): boolean { return s !== 'active'; }
/** A still-active grant can be closed early two ways (mirrors entity end()/revoke(); both require active). */
export function canEndGrant(s: GrantStatus): boolean { return s === 'active'; }
export function canRevokeGrant(s: GrantStatus): boolean { return s === 'active'; }

// Deliberate safety bounds (mirror admin-api scope.ts + dto).
export const IMPERSONATION_SCOPES = ['read_only'] as const;
export type ImpersonationScope = (typeof IMPERSONATION_SCOPES)[number];
export const TTL_MIN_SEC = 60;
export const TTL_MAX_SEC = 3600;
export const TTL_DEFAULT_SEC = 900;
export const REASON_MIN = 8;            // act-as demands a real justification (deliberate)
export const REASON_MAX = 1000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: string | null | undefined): boolean { return UUID_RE.test((v ?? '').trim()); }
export function validReason(r: string | null | undefined): boolean {
  const s = (r ?? '').trim();
  return s.length >= REASON_MIN && s.length <= REASON_MAX;
}
// float-free ttl parse: a 2–4 digit string, unary + (exact integer), bounded to [60,3600].
function parseTtl(raw: string | undefined): number | null {
  const s = (raw ?? '').trim();
  if (!s) return TTL_DEFAULT_SEC;
  if (!/^[0-9]{2,4}$/.test(s)) return null;
  const n = +s;
  return n >= TTL_MIN_SEC && n <= TTL_MAX_SEC ? n : null;
}

export type StartGrantResult =
  | { ok: true; value: { targetTenantId: string; targetUserId: string; reason: string; ttlSec: number; scope: ImpersonationScope } }
  | { ok: false; error: 'targetTenantId' | 'targetUserId' | 'reason' | 'ttlSec' | 'scope' };

export function buildStartGrant(raw: { targetTenantId?: string; targetUserId?: string; reason?: string; ttlSec?: string; scope?: string }): StartGrantResult {
  const targetTenantId = (raw.targetTenantId ?? '').trim();
  if (!isUuid(targetTenantId)) return { ok: false, error: 'targetTenantId' };
  const targetUserId = (raw.targetUserId ?? '').trim();
  if (!isUuid(targetUserId)) return { ok: false, error: 'targetUserId' };
  if (!validReason(raw.reason)) return { ok: false, error: 'reason' };
  const ttlSec = parseTtl(raw.ttlSec);
  if (ttlSec === null) return { ok: false, error: 'ttlSec' };
  const scope = (raw.scope ?? 'read_only').trim();
  if (!(IMPERSONATION_SCOPES as readonly string[]).includes(scope)) return { ok: false, error: 'scope' };
  return { ok: true, value: { targetTenantId, targetUserId, reason: (raw.reason ?? '').trim(), ttlSec, scope: scope as ImpersonationScope } };
}

export type ReasonResult = { ok: true; value: { reason: string } } | { ok: false; error: 'reason' };
export function buildReason(raw: { reason?: string }): ReasonResult {
  if (!validReason(raw.reason)) return { ok: false, error: 'reason' };
  return { ok: true, value: { reason: (raw.reason ?? '').trim() } };
}

// ---- read-model shapes (mirror admin-api impersonation read models; type-only, no runtime). NOTE: the act-as
//      token is intentionally absent — it is never returned to the browser. ----
export interface GrantRow {
  id: string; adminUserId: string; targetTenantId: string; targetUserId: string; reason: string;
  scope: ImpersonationScope | string; status: GrantStatus; expiresAt: string | null;
  endedAt: string | null; endedBy: string | null; endReason: string | null; createdAt: string | null;
}
export interface ActionRow { id: string; grantId: string; method: string; path: string; action: string | null; createdAt: string | null }
