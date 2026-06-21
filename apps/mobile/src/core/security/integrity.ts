// apps/mobile/src/core/security/integrity.ts · DEVICE-INTEGRITY signal (guide §4). On sensitive flows (login,
// payments, payouts, KYC) we attach a compact, NON-PII risk signal header the SERVER uses for risk scoring. The
// app NEVER blocks itself on a "clean device" claim — a patched client would just lie; the server is the authority
// (Law 11). We treat a failed/absent attestation as a SIGNAL, not a hard client block (degrade — Law 12).
// The real signal comes from a native provider (root/jailbreak detection + Play Integrity / App Attest) injected
// via setIntegrityProvider(); with no provider (offline sandbox / dev) the default reports 'unknown' and never
// claims the device is clean. Header value is a short token list — carries NO identifiers/PII.

export interface IntegrityResult {
  /** Coarse posture the server scores; 'unknown' when no attestation ran. NEVER assert 'clean' without proof. */
  posture: 'attested' | 'unknown' | 'compromised';
  /** Best-effort local checks (advisory only; a rooted device can hide these). */
  rootedHint?: boolean;
  emulatorHint?: boolean;
}
export interface IntegrityProvider { evaluate(): Promise<IntegrityResult> }

let provider: IntegrityProvider | null = null;
/** Wire the native provider at boot (release builds). No-op default keeps dev/tests + the offline sandbox safe. */
export function setIntegrityProvider(p: IntegrityProvider | null): void { provider = p; }

/** Build the compact, PII-free header value from a result, e.g. "posture=unknown;root=0;emu=0". Server-scored. */
export function buildIntegrityHeader(r: IntegrityResult): string {
  const posture = r.posture === 'attested' || r.posture === 'compromised' ? r.posture : 'unknown';
  return `posture=${posture};root=${r.rootedHint ? 1 : 0};emu=${r.emulatorHint ? 1 : 0}`;
}

/** The default, honest posture when nothing has attested — never claims the device is clean. */
export const UNKNOWN_INTEGRITY: IntegrityResult = { posture: 'unknown', rootedHint: false, emulatorHint: false };

/** Header map for the SDK `getHeaders` hook. Best-effort: any provider failure → the honest 'unknown' signal. */
export async function integrityHeaders(): Promise<Record<string, string>> {
  let result = UNKNOWN_INTEGRITY;
  if (provider) { try { result = await provider.evaluate(); } catch { result = UNKNOWN_INTEGRITY; } }
  return { 'x-device-integrity': buildIntegrityHeader(result) };
}

/** Sensitive API paths (login/pay/payout/KYC/attendance) — the server raises scrutiny when the signal is weak.
 * Plain prefix match (no regex on input). The header rides on EVERY request anyway; this just documents intent. */
const SENSITIVE_PREFIXES = ['auth/', 'payments/', 'payouts/', 'wallet', 'kyc', 'bank-accounts', 'labour/attendance'];
export function isSensitivePath(path: string): boolean {
  const p = (path ?? '').replace(/^\/+/, '').toLowerCase();
  return SENSITIVE_PREFIXES.some((pre) => p.startsWith(pre));
}
