// apps/web-storefront/src/app/login/page.tsx · the phone-OTP sign-in page. Server component: it resolves the
// localized labels (server-only i18n helper) and the same-origin `next` return path, then hands them to the
// client <LoginForm>. The page is noindex (a login screen has no SEO value and shouldn't appear in search). If
// the visitor already has a session we send them straight on — no reason to show login twice.
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslator } from '../../lib/i18n';
import { resolveSessionToken, safeNext } from '../../lib/session';
import { LoginForm, type LoginLabels } from '../../components/LoginForm';

export function generateMetadata(): Metadata {
  const t = getTranslator();
  return { title: t.t('auth.title'), description: t.t('auth.lead'), robots: { index: false, follow: false } };
}

export default async function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  const next = safeNext(searchParams.next);
  // Already signed in (or silently refreshable)? Skip the form.
  if (await resolveSessionToken()) redirect(next);

  const t = getTranslator();
  const labels: LoginLabels = {
    phoneLabel: t.t('auth.phoneLabel'), phonePlaceholder: t.t('auth.phonePlaceholder'), phoneHint: t.t('auth.phoneHint'),
    sendCode: t.t('auth.sendCode'), codeLabel: t.t('auth.codeLabel'), codePlaceholder: t.t('auth.codePlaceholder'),
    codeHint: t.t('auth.codeHint'), verify: t.t('auth.verify'), changeNumber: t.t('auth.changeNumber'),
    sending: t.t('auth.sending'), verifying: t.t('auth.verifying'),
  };

  return (
    <section className="kv-auth">
      <h1>{t.t('auth.title')}</h1>
      <p className="kv-prose__lead">{t.t('auth.lead')}</p>
      <LoginForm next={next} labels={labels} />
    </section>
  );
}
