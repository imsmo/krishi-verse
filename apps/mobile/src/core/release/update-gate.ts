// apps/mobile/src/core/release/update-gate.ts · the FORCED-UPDATE FLOOR + recommended-update decision (guide §8).
// The server/remote-config sets the minimum (hard floor) and recommended (soft nudge) supported versions; this
// PURE decision compares them against the current build so a build below the floor is BLOCKED at boot until the
// user updates (a known-bad/insecure client can't keep talking to the API). Self-contained (own semver compare)
// so the root layout can import it without pulling a feature module. The remote thresholds are injected at boot
// (flags/remote-config); config provides the static fallback. NO PII, no network here — just the decision.

export type UpdateDecision = 'forced' | 'recommended' | 'none';

/** Numeric dotted-version compare: -1 (a<b), 0 (=), 1 (a>b). Non-numeric parts coerce to 0. */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const pa = String(a ?? '').split('.').map((x) => parseInt(x, 10) || 0);
  const pb = String(b ?? '').split('.').map((x) => parseInt(x, 10) || 0);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) { const d = (pa[i] ?? 0) - (pb[i] ?? 0); if (d !== 0) return d < 0 ? -1 : 1; }
  return 0;
}

/** Decide the update posture. `forced` when current < min (hard floor); else `recommended` when current <
 * recommended; else `none`. Missing thresholds are treated as "no constraint" (degrade — never block on a gap). */
export function decideUpdate(current: string, min?: string | null, recommended?: string | null): UpdateDecision {
  if (min && compareVersions(current, min) < 0) return 'forced';
  if (recommended && compareVersions(current, recommended) < 0) return 'recommended';
  return 'none';
}

// --- remote thresholds (set at boot from remote-config; fall back to static config) ---
let remoteMin: string | null = null;
let remoteRecommended: string | null = null;
/** Wire the remote-config thresholds (e.g. from the flags/remote hydrate). Null clears an override. */
export function setUpdateThresholds(min: string | null, recommended: string | null = null): void {
  remoteMin = min; remoteRecommended = recommended;
}
export function effectiveMin(staticMin?: string): string | null { return remoteMin ?? staticMin ?? null; }
export function effectiveRecommended(staticRec?: string): string | null { return remoteRecommended ?? staticRec ?? null; }
