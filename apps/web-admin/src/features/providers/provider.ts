// apps/web-admin/src/features/providers/provider.ts · PURE, framework-free helpers + types for the god-mode
// integration-provider registry console. No fetch, no React → unit-tested. MIRRORS admin-api providers-ops:
// the provider vocabulary (domain/category), the enable/disable toggle (the one consequential write — Law 12,
// pull a failing provider out of rotation platform-wide) which REJECTS a no-op (already-in-state → 409), and the
// "degraded" health signal (provider DISABLED but tenants still reference it → those integrations fail until
// re-enabled or migrated). NO secret material is ever modelled here — only the registry + credential-ref COUNTS.

// Mirrors admin-api domain/category.ts.
export const PROVIDER_CATEGORIES = ['payment', 'sms', 'kyc', 'government', 'satellite'] as const;
export type ProviderCategory = (typeof PROVIDER_CATEGORIES)[number];
/** The money-path categories the finance ops lens focuses on (mirrors FINANCIAL_CATEGORIES). */
export const FINANCIAL_CATEGORIES: readonly ProviderCategory[] = ['payment', 'kyc'];

export function isValidCategory(c: string | null | undefined): c is ProviderCategory {
  return (PROVIDER_CATEGORIES as readonly string[]).includes(c ?? '');
}
/** Normalise a category for display lookup — falls back to 'unknown' for an unrecognised value (degrade, never die). */
export function categoryKey(c: string | null | undefined): ProviderCategory | 'unknown' {
  return isValidCategory(c) ? c : 'unknown';
}

// ---- the enable/disable toggle (PATCH :code {action,reason}) surfaced only when it is a real change ----
export const TOGGLE_ACTIONS = ['enable', 'disable'] as const;
export type ToggleAction = (typeof TOGGLE_ACTIONS)[number];

/** Enable is legal only when currently inactive (admin-api rejects a no-op → 409). */
export function canEnable(isActive: boolean): boolean { return !isActive; }
/** Disable is legal only when currently active (admin-api rejects a no-op → 409). */
export function canDisable(isActive: boolean): boolean { return isActive; }

export function validReason(r: string | null | undefined): boolean {
  const v = (r ?? '').trim();
  return v.length >= 3 && v.length <= 1000;
}

export type ToggleResult =
  | { ok: true; value: { action: ToggleAction; reason: string } }
  | { ok: false; error: 'action' | 'reason' };

export function buildToggle(raw: { action?: string; reason?: string }): ToggleResult {
  const action = (raw.action ?? '').trim();
  if (!(TOGGLE_ACTIONS as readonly string[]).includes(action)) return { ok: false, error: 'action' };
  if (!validReason(raw.reason)) return { ok: false, error: 'reason' };
  return { ok: true, value: { action: action as ToggleAction, reason: (raw.reason ?? '').trim() } };
}

// ---- health signal (mirrors provider-sla-monitor: degraded = disabled but still referenced) ----
export interface ProviderHealth { configuredTenants: number; activeTenants: number }

/** A provider is DEGRADED when it is disabled yet tenants still point at it — those integrations fail until it is
 *  re-enabled or those tenants migrate. (The health/financial endpoints precompute this; for the single-get detail
 *  view we derive it the same way.) */
export function isDegraded(p: { isActive: boolean; health?: ProviderHealth | null }): boolean {
  return !p.isActive && (p.health?.configuredTenants ?? 0) > 0;
}

export type ProviderHealthKey = 'degraded' | 'active' | 'disabled';
export function providerHealthKey(p: { isActive: boolean; health?: ProviderHealth | null }): ProviderHealthKey {
  if (isDegraded(p)) return 'degraded';
  return p.isActive ? 'active' : 'disabled';
}

// ---- read-model shapes (mirror admin-api providers-ops read models; type-only, no runtime) ----
export interface ProviderRow {
  code: string;
  defaultName: string;
  category: ProviderCategory | string;
  isActive: boolean;
  createdAt: string | null;
  health: ProviderHealth;
}
/** health/financial rollup rows carry the precomputed `degraded` flag. */
export interface ProviderHealthRow extends ProviderRow { degraded: boolean }
/** GET :code returns the registry row + credential-ref health (no precomputed degraded — derive via isDegraded). */
export type ProviderDetail = ProviderRow;
export interface ProviderChange {
  id: string;
  providerCode: string;
  action: string;          // 'enabled' | 'disabled' (recorded change action)
  oldValue: unknown;
  newValue: unknown;
  reason: string;
  actorUserId: string;
  createdAt: string | null;
}
