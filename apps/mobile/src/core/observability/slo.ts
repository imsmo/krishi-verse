// apps/mobile/src/core/observability/slo.ts · client SLO catalog (guide §6). These targets back the dashboards +
// alerts that live in the crash/analytics service (server-side) — the app emits the raw events; this is the
// machine-readable definition CI/dashboards consume so the numbers don't drift across docs. PURE helper to check
// a measured value against its target.

export interface SloTarget { key: string; target: number; unit: 'ratio'; direction: 'gte' }

/** The launch SLOs (guide §6: crash-free ≥ 99.5%, login/listing/checkout success). Ratios in [0,1]. */
export const SLOS: SloTarget[] = [
  { key: 'crash_free_sessions', target: 0.995, unit: 'ratio', direction: 'gte' },
  { key: 'login_success', target: 0.98, unit: 'ratio', direction: 'gte' },
  { key: 'listing_create_success', target: 0.97, unit: 'ratio', direction: 'gte' },
  { key: 'checkout_success', target: 0.97, unit: 'ratio', direction: 'gte' },
];

export function sloFor(key: string): SloTarget | undefined { return SLOS.find((s) => s.key === key); }

/** Does a measured ratio meet its SLO target? Unknown key → false (fail-closed; a new metric needs a target). */
export function meetsSlo(key: string, measured: number): boolean {
  const s = sloFor(key);
  if (!s) return false;
  return measured >= s.target;
}
