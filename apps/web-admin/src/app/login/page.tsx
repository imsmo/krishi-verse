// apps/web-admin/src/app/login/page.tsx · god-mode sign-in. Strong auth (FIDO2 hardware key + step-up) is
// performed by the admin IdP, NOT here — admin-api enforces the resulting claims on every call (Law 11). This
// page links to the IdP and explains the requirement; it never accepts a password in the UI. (In deployment the
// IdP redirects back with the session set via a server-side callback that calls setAdminSession.)
import { env } from '../../lib/env';

export default function AdminLoginPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <section style={{ maxWidth: 480, margin: '64px auto' }}>
      <h1>{env.appName}</h1>
      <p>This is the platform <strong>god-mode</strong> console. Access requires a hardware security key (FIDO2)
        and a recent step-up re-authentication, enforced by the admin API on every request.</p>
      {searchParams.error && <p className="kv-error">Sign-in did not complete. Contact platform security.</p>}
      <p style={{ marginTop: 24 }}>
        <a className="kv-btn" href={`${env.publicAdminApiUrl}/auth/sso/start`}>Sign in with hardware key →</a>
      </p>
      <p style={{ color: 'var(--kv-neutral-600)', marginTop: 16 }}>Sessions are short-lived; sensitive operations
        prompt for fresh re-authentication.</p>
    </section>
  );
}
