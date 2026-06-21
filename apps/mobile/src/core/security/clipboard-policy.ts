// apps/mobile/src/core/security/clipboard-policy.ts · clipboard guard (guide §4: "don't put OTP/tokens on the
// clipboard"). The app today copies NOTHING to the clipboard (audited — no Clipboard import anywhere). This pure
// policy is the guard any future copy action must pass through: sensitive kinds (otp/token/bank/aadhaar/pan) are
// NEVER copyable; only explicitly-allowed kinds (e.g. an order number / public ref) may be copied. No native dep
// here — a screen that wants to copy calls `assertCopyable(kind)` first, then uses expo-clipboard.
export type ClipboardKind = 'orderNo' | 'ticketNo' | 'publicRef' | 'otp' | 'token' | 'bank' | 'aadhaar' | 'pan';

const COPYABLE: ReadonlySet<ClipboardKind> = new Set<ClipboardKind>(['orderNo', 'ticketNo', 'publicRef']);

/** True only for non-sensitive, explicitly allowlisted kinds. Everything else (incl. unknown) is refused. */
export function isCopyAllowed(kind: ClipboardKind | string): boolean {
  return COPYABLE.has(kind as ClipboardKind);
}
