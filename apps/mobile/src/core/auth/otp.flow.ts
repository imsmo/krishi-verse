// apps/mobile/src/core/auth/otp.flow.ts · the phone-OTP login flow helpers. The network calls go through the
// SDK auth resource (enumeration-safe by API contract); this module owns the CLIENT-side concerns that must be
// correct and testable: phone normalization to E.164 (the API requires it), a stable per-attempt idempotency
// key, and the resend-cooldown clock. Pure functions where possible (see __tests__/otp.flow.spec.ts).
import { anonClient } from '../api/client';
import { config } from '../config';
export { normalizeIndianPhone, resendSecondsRemaining, RESEND_COOLDOWN_SEC } from './otp.helpers';

/** Request an OTP. Throws only on a hard transport error; the API response is enumeration-safe either way. */
export async function requestOtp(phoneE164: string, idempotencyKey: string): Promise<void> {
  await anonClient().auth.requestOtp(phoneE164, idempotencyKey);
}

/** Verify an OTP → tokens. Lets SdkError propagate so the screen can map invalid/too-many to a friendly message. */
export async function verifyOtp(phoneE164: string, code: string, idempotencyKey: string) {
  return anonClient().auth.verifyOtp(phoneE164, code, idempotencyKey, config.tenantId);
}
