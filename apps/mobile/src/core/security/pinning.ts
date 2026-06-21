// apps/mobile/src/core/security/pinning.ts · TLS certificate/public-key PINNING config + validators (guide §4).
// The actual pin ENFORCEMENT happens natively in release builds (network-security-config on Android via the
// `pins` declared in app.config, and an iOS App Transport Security / NSURLSession pinning hook) — pinning cannot
// be enforced from JS, and a patched client could strip a JS check anyway. This module owns the *config* the
// native layer consumes plus PURE validators we unit-test, so a malformed/empty pin set is caught in CI, not in
// the field. Every host MUST ship a backup pin (rotation plan, §4) so a cert rotation can't brick the app.
// PINS are loaded from public config (sha256/base64 SPKI hashes — not secrets); the API origin is pinned in prod.

export interface HostPins { host: string; pins: string[]; includeSubdomains?: boolean }

/** A base64 SHA-256 SPKI pin: 44 chars ending in '=' (32 bytes → base64). Plain check, no ReDoS. */
const PIN_RE = /^[A-Za-z0-9+/]{43}=$/;
export function isValidPin(pin: string): boolean { return PIN_RE.test((pin ?? '').trim()); }

/** A pin set is valid for production iff: a host, ≥2 pins (primary + backup for rotation), all well-formed. */
export function isValidHostPins(hp: HostPins | null | undefined): boolean {
  if (!hp || !hp.host || !Array.isArray(hp.pins)) return false;
  if (hp.pins.length < 2) return false; // primary + backup (rotation) — §4
  return hp.pins.every(isValidPin) && new Set(hp.pins).size === hp.pins.length;
}

/** Extract the host of a URL (lowercased, no port) — for matching a request against the pin set. Null if bad. */
export function hostOf(url: string): string | null {
  const m = /^https:\/\/([^/:?#]+)/i.exec((url ?? '').trim());
  return m ? m[1].toLowerCase() : null;
}

/** Whether a URL's host is covered by a pin set (exact host, or a subdomain when includeSubdomains). */
export function isPinnedHost(url: string, pinsList: HostPins[]): boolean {
  const host = hostOf(url);
  if (!host) return false;
  return pinsList.some((hp) => host === hp.host.toLowerCase() || (!!hp.includeSubdomains && host.endsWith(`.${hp.host.toLowerCase()}`)));
}

/** Gate used at build/CI time: the prod pin config must be non-empty AND every entry valid. */
export function pinConfigReady(pinsList: HostPins[]): boolean {
  return Array.isArray(pinsList) && pinsList.length > 0 && pinsList.every(isValidHostPins);
}
