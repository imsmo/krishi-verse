// apps/mobile/src/core/security/index.ts · public surface for the security core (guide §4). Screens/boot import
// from here only. FLAG_SECURE (useSecureScreen), TLS-pin config + validators, device-integrity signal + provider
// wiring, inbound deep-link guard, and the clipboard policy. Enforcement that must be native (pinning, root/
// attestation, obfuscation) lives in the release build config; this module owns the config + the PURE logic CI
// verifies, and the runtime hooks the app wires.
export { useSecureScreen } from './screen-guard';
export { isValidPin, isValidHostPins, hostOf, isPinnedHost, pinConfigReady, type HostPins } from './pinning';
export { setIntegrityProvider, buildIntegrityHeader, integrityHeaders, isSensitivePath, UNKNOWN_INTEGRITY, type IntegrityResult, type IntegrityProvider } from './integrity';
export { parseDeepLink, isSafeParamValue, APP_SCHEME, DEEPLINK_ALLOWLIST, type ParsedLink } from './deeplink-guard';
export { isCopyAllowed, type ClipboardKind } from './clipboard-policy';
