// apps/web-admin/src/app/login/page.tsx · god-mode sign-in. Strong auth (FIDO2 hardware key + step-up) is
// performed by the admin IdP, NOT here — admin-api enforces the resulting claims on every call (Law 11). This page
// links to the IdP and explains the requirement; it never accepts a password in the UI. (In deployment the IdP
// redirects back with the session set via a server-side callback that calls setAdminSession.) All copy via i18n.
import type { Metadata } from 'next';
import { env } from '../../lib/env';
import { getTranslator } from '../../lib/i18n';

export function generateMetadata(): Metadata {
  return { title: getTranslator().t('login.title'), robots: { index: false, follow: false } };
}

export default function AdminLoginPage({ searchParams }: { searchParams: { error?: string } }) {
  const t = getTranslator();
  return (
    <section className="kv-login">
      <h1>{t.t('login.title')}</h1>
      <p>{t.t('login.lead')}</p>
      {searchParams.error && <p className="kv-error" role="alert">{t.t('login.failed')}</p>}
      <p className="kv-login__cta">
        <a className="kv-btn" href={`${env.publicAdminApiUrl}/auth/sso/start`}>{t.t('login.cta')}</a>
      </p>
      <p className="kv-muted">{t.t('login.note')}</p>
    </section>
  );
}
