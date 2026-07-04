// apps/mobile/src/features/system/change-phone.ts · PURE logic for the change-phone screen (176). No React/native,
// no I/O → unit-tested. Owns the reason vocabulary (a fixed enum the server would accept) and the client-side
// new-mobile validation for UX (the server re-validates + owns the OTP). No PII is stored here.

export const CHANGE_PHONE_REASONS = ['lost', 'sim', 'preference'] as const;
export type ChangePhoneReason = (typeof CHANGE_PHONE_REASONS)[number];

/** The i18n label key for a reason chip. Pure. */
export function reasonLabelKey(reason: ChangePhoneReason): string {
  return `changePhone.reason.${reason}`;
}

/** True when the input is a plausible Indian 10-digit mobile (starts 6–9). Accepts stray spaces/dashes. The
 *  server re-validates + normalizes to E.164 — this is only to gate the "Send OTP" button (UX). Pure. */
export function isValidNewMobile(raw: string | null | undefined): boolean {
  const digits = (raw ?? '').replace(/\D/g, '');
  return /^[6-9]\d{9}$/.test(digits);
}

/** Strip to the bare 10 digits (for building the E.164 `+91…` the API wants). '' if not 10 clean digits. Pure. */
export function normalizeNewMobile(raw: string | null | undefined): string {
  const digits = (raw ?? '').replace(/\D/g, '');
  return isValidNewMobile(digits) ? digits : '';
}
