// apps/mobile/src/core/security/screen-capture-guard.ts · PURE FLAG_SECURE on/off wiring (guide §4). Framework-
// free by design (no react / expo-router / expo-screen-capture runtime imports) so it can run in the core unit-
// test harness (node, ts-jest, no RN transform) alongside the rest of core/security's pure logic. The React hook
// that drives this from navigation focus/blur lives in screen-guard.ts.
export interface ScreenCaptureGuard {
  preventScreenCaptureAsync: () => Promise<unknown>;
  allowScreenCaptureAsync: () => Promise<unknown>;
}

/** Call when a screen gains FOCUS; call the returned cleanup when it loses focus (BLUR) — deliberately not tied
 * to React mount/unmount (see screen-guard.ts header for why that distinction is the MF-01 fix). Degrades
 * silently — never throws — if the native module rejects (Law 12). */
export function engageSecureScreen(guard: ScreenCaptureGuard): () => void {
  guard.preventScreenCaptureAsync().catch(() => { /* no-op: degrade */ });
  return () => {
    guard.allowScreenCaptureAsync().catch(() => { /* no-op */ });
  };
}
