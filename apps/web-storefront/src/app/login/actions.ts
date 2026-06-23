'use server';
// apps/web-storefront/src/app/login/actions.ts · the login flow's server mutations. Phone-OTP, two steps in one
// state machine (request → verify) driven by the form's `intent` field, so a SINGLE useFormState backs the whole
// form. SECURITY:
//  - Anonymous SDK calls only (publicClient — no session attached); the access/refresh tokens returned by verify
//    are written straight into httpOnly cookies (lib/auth.setSession) and NEVER returned to the client.
//  - Enumeration-safe: requesting a code always reports the same neutral "code sent" notice whether or not the
//    phone is registered, and even if the API call fails — the page can't be used to probe which numbers exist.
//  - Idempotency-Key on every mutation (a refresh/double-submit can't trigger a second OTP or a second verify).
//  - The OTP code itself is never echoed back into the returned state / HTML.
//  - `next` is validated same-origin before redirecting (open-redirect guard).
import { randomUUID } from 'crypto';
import { redirect } from 'next/navigation';
import { publicClient } from '../../lib/api-client';
import { setSession, clearSession } from '../../lib/auth';
import { safeNext } from '../../lib/session';
import { getTranslator } from '../../lib/i18n';
import type { LoginState } from './state';

// E.164: a leading +, country digit 1-9, up to 15 total digits. We also accept a bare 10-digit Indian mobile and
// normalise it to +91 (the primary market) — anything else must already be in full international form.
function normalisePhone(raw: string): string | null {
  const trimmed = raw.replace(/[\s-]/g, '');
  const candidate = /^\d{10}$/.test(trimmed) ? `+91${trimmed}` : trimmed;
  return /^\+[1-9]\d{7,14}$/.test(candidate) ? candidate : null;
}

/** Single dispatcher: branch on the submitted `intent`. Keeps one useFormState across both steps. */
export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const t = getTranslator();
  const intent = String(formData.get('intent') ?? 'request');

  if (intent === 'reset') return { step: 'phone' };

  const phone = normalisePhone(String(formData.get('phone') ?? ''));

  if (intent === 'request') {
    if (!phone) return { step: 'phone', error: t.t('auth.errInvalidPhone') };
    try {
      await publicClient().auth.requestOtp(phone, randomUUID());
    } catch {
      // Swallow: "send failed" vs "sent" would leak whether the number exists / is rate-limited.
    }
    return { step: 'code', phone, notice: t.t('auth.otpNotice') };
  }

  // intent === 'verify'
  const code = String(formData.get('code') ?? '').replace(/\s/g, '');
  const next = safeNext(String(formData.get('next') ?? '/'));
  if (!phone) return { step: 'phone', error: t.t('auth.errInvalidPhone') };
  if (!/^\d{4,8}$/.test(code)) return { step: 'code', phone, error: t.t('auth.errInvalidCode') };
  try {
    const tokens = await publicClient().auth.verifyOtp(phone, code, randomUUID());
    setSession(tokens);
  } catch {
    // Wrong/expired code, or a transient failure — one generic message (never distinguish, never echo the code).
    return { step: 'code', phone, error: t.t('auth.errVerifyFailed') };
  }
  redirect(next); // outside the try: redirect() throws control-flow, must not be caught.
}

/** Log out: clear both cookies and return home. Used as <form action={logoutAction}> in the header. */
export async function logoutAction(): Promise<void> {
  clearSession();
  redirect('/');
}
