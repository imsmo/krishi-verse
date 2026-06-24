// apps/web-partner/src/app/login/page.tsx · phone-OTP sign-in (two steps). The strong-auth flow lives in the API;
// this page only collects the phone + OTP and posts to the login Server Actions, which store the returned tokens in
// httpOnly cookies. Errors surface as a query flag, never leaking whether the phone exists. All copy via i18n; no
// inline styles; noindex.
import type { Metadata } from 'next';
import { getTranslator } from '../../lib/i18n';
import { requestOtpAction, verifyOtpAction } from './actions';

export function generateMetadata(): Metadata {
  return { title: getTranslator().t('login.title'), robots: { index: false, follow: false } };
}

export default function LoginPage({ searchParams }: { searchParams: { step?: string; phone?: string; error?: string } }) {
  const t = getTranslator();
  const verifying = searchParams.step === 'verify';
  return (
    <section className="kv-login">
      <h1>{t.t('login.title')}</h1>
      <p className="kv-muted">{t.t('login.lead')}</p>
      {searchParams.error && <p className="kv-error" role="alert">{t.t('login.failed')}</p>}
      {!verifying ? (
        <form action={requestOtpAction} className="kv-form">
          <label htmlFor="phone" className="kv-field__label">{t.t('login.phoneLabel')}</label>
          <input id="phone" className="kv-input" name="phone" inputMode="tel" placeholder={t.t('login.phoneHint')} required />
          <button className="kv-btn" type="submit">{t.t('login.sendOtp')}</button>
        </form>
      ) : (
        <form action={verifyOtpAction} className="kv-form">
          <input type="hidden" name="phone" value={searchParams.phone ?? ''} />
          <label htmlFor="code" className="kv-field__label">{t.t('login.codeLabel', { phone: searchParams.phone ?? '' })}</label>
          <input id="code" className="kv-input" name="code" inputMode="numeric" autoComplete="one-time-code" required />
          <button className="kv-btn" type="submit">{t.t('login.verify')}</button>
        </form>
      )}
    </section>
  );
}
