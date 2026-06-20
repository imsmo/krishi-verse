// apps/mobile/src/core/auth/otp.helpers.ts · the PURE, dependency-free parts of the OTP flow (phone
// normalization + resend cooldown clock). Split out from otp.flow so they can be unit-tested without dragging in
// the SDK/expo (otp.flow re-exports them). No imports = trivially testable + reusable.

/** Normalize an Indian mobile number to E.164 (+91XXXXXXXXXX). Returns null if it can't be a valid 10-digit
 * Indian mobile (must start 6–9). Accepts spaces, dashes, leading 0, +91, or bare 10 digits. */
export function normalizeIndianPhone(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, '');
  let local = digits;
  if (local.startsWith('91') && local.length === 12) local = local.slice(2);
  else if (local.startsWith('0') && local.length === 11) local = local.slice(1);
  if (!/^[6-9]\d{9}$/.test(local)) return null;
  return `+91${local}`;
}

export const RESEND_COOLDOWN_SEC = 30;

/** Seconds remaining before a resend is allowed, given when the last code was sent. Never negative. */
export function resendSecondsRemaining(lastSentAtMs: number, nowMs: number, cooldownSec = RESEND_COOLDOWN_SEC): number {
  const elapsed = Math.floor((nowMs - lastSentAtMs) / 1000);
  return Math.max(0, cooldownSec - elapsed);
}
