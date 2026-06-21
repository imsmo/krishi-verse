// apps/mobile/src/core/release/ota.ts · OTA (expo-updates) check/fetch/reload with FLAG DISCIPLINE (guide §8).
// JS-only fixes ship over-the-air on the same `production`/`preview` channel as the binary build; an OTA update
// is gated by the `ota_updates` flag (kill-switch — a bad OTA can be disabled remotely without a store release)
// and NEVER auto-reloads mid-critical-flow. The native expo-updates calls are injected via a port so the offline
// sandbox/dev/tests stay native-free; the DECISION (`shouldApplyOta`) is PURE + unit-tested. Rollback = flip the
// flag off + republish the previous OTA (runbook: RELEASE.md).

export interface OtaState { enabled: boolean; available: boolean; isCriticalFlow: boolean }
/** Apply an OTA update only when the flag is on, an update is available, and we're not mid-critical-flow
 * (checkout/pay/OTP) — reloading there would lose the user's work. PURE. */
export function shouldApplyOta(s: OtaState): boolean {
  return !!s.enabled && !!s.available && !s.isCriticalFlow;
}

export interface OtaProvider {
  checkForUpdate(): Promise<{ isAvailable: boolean }>;
  fetchUpdate(): Promise<{ isNew: boolean }>;
  reload(): Promise<void>;
}
let provider: OtaProvider | null = null;
/** Wire the expo-updates-backed provider at boot in release builds. No-op default keeps dev/tests safe. */
export function setOtaProvider(p: OtaProvider | null): void { provider = p; }

/** Best-effort OTA check+fetch on foreground (NOT during a critical flow). Returns whether a new bundle is staged
 * (the app applies it on the next cold start, or the caller may reload at a safe point). Never throws. */
export async function checkAndFetchOta(opts: { enabled: boolean; isCriticalFlow: boolean }): Promise<{ staged: boolean }> {
  if (!provider || !opts.enabled || opts.isCriticalFlow) return { staged: false };
  try {
    const { isAvailable } = await provider.checkForUpdate();
    if (!isAvailable) return { staged: false };
    const { isNew } = await provider.fetchUpdate();
    return { staged: !!isNew };
  } catch { return { staged: false }; } // degrade-never-die — an OTA hiccup must never break the app
}
