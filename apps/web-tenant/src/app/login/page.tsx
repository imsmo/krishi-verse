// apps/web-tenant/src/app/login/page.tsx · phone-OTP login (two steps via Server Actions). Step 1 requests an
// OTP (enumeration-safe by the API). Step 2 verifies → the API returns tokens → we store them in httpOnly
// cookies (never exposed to JS) and redirect into the console. Errors surface as a query flag, never leaking
// whether the phone exists. No secrets in the client.
import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { anonClient } from '../../lib/api-client';
import { setSession } from '../../lib/auth';
import { SdkError } from '@krishi-verse/sdk-js';

async function requestOtp(formData: FormData) {
  'use server';
  const phone = String(formData.get('phone') ?? '').trim();
  try { await anonClient().auth.requestOtp(phone, randomUUID()); } catch { /* enumeration-safe: same next step regardless */ }
  redirect(`/login?step=verify&phone=${encodeURIComponent(phone)}`);
}
async function verifyOtp(formData: FormData) {
  'use server';
  const phone = String(formData.get('phone') ?? '').trim();
  const code = String(formData.get('code') ?? '').trim();
  try {
    const t = await anonClient().auth.verifyOtp(phone, code, randomUUID());
    setSession(t.accessToken, t.refreshToken, t.expiresInSec);
  } catch (e) {
    const msg = e instanceof SdkError ? e.code : 'LOGIN_FAILED';
    redirect(`/login?step=verify&phone=${encodeURIComponent(phone)}&error=${encodeURIComponent(msg)}`);
  }
  redirect('/dashboard');
}

export default function LoginPage({ searchParams }: { searchParams: { step?: string; phone?: string; error?: string } }) {
  const verifying = searchParams.step === 'verify';
  return (
    <section style={{ maxWidth: 420, margin: '64px auto' }}>
      <h1>Sign in</h1>
      {searchParams.error && <p className="kv-error">Could not sign in. Check the code and try again.</p>}
      {!verifying ? (
        <form action={requestOtp}>
          <label>Phone (E.164)<br /><input className="kv-input" name="phone" inputMode="tel" placeholder="+9198…" required /></label>
          <p><button className="kv-btn" type="submit">Send OTP</button></p>
        </form>
      ) : (
        <form action={verifyOtp}>
          <input type="hidden" name="phone" value={searchParams.phone ?? ''} />
          <label>Enter the OTP sent to {searchParams.phone}<br /><input className="kv-input" name="code" inputMode="numeric" autoComplete="one-time-code" required /></label>
          <p><button className="kv-btn" type="submit">Verify &amp; continue</button></p>
        </form>
      )}
    </section>
  );
}
