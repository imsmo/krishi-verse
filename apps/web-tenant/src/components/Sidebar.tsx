// apps/web-tenant/src/components/Sidebar.tsx · the console chrome (server component). Renders the localized nav
// — which links ONLY to built routes — the signed-in staff name + roles from auth.me() (degrades to a generic
// label if the call fails, Law 12), the locale switcher, and a sign-out form (POST /api/session clears the
// httpOnly cookies). As later waves add routes, append them here (optionally role-filtered); never link to a
// route that doesn't exist. The API re-enforces RBAC on every call regardless of what the nav shows.
import Link from 'next/link';
import type { UserProfile } from '@krishi-verse/sdk-js';
import { tenantClient } from '../lib/api-client';
import { getTranslator, getLang } from '../lib/i18n';
import { env } from '../lib/env';
import { LocaleSwitcher } from './LocaleSwitcher';

export async function Sidebar() {
  const t = getTranslator();
  const lang = getLang();
  let me: UserProfile | null = null;
  try { me = await tenantClient().auth.me(); } catch { me = null; }

  const nav = [
    { href: '/dashboard', label: t.t('nav.dashboard') },
    { href: '/listings', label: t.t('nav.listings') },
    { href: '/orders', label: t.t('nav.orders') },
    { href: '/offers', label: t.t('nav.offers') },
    { href: '/payouts', label: t.t('nav.payouts') },
    { href: '/wallet', label: t.t('nav.wallet') },
    ...(env.featureAuctions ? [{ href: '/auctions', label: t.t('nav.auctions') }] : []),
    { href: '/disputes', label: t.t('nav.disputes') },
    { href: '/notifications', label: t.t('nav.notifications') },
    { href: '/billing', label: t.t('nav.billing') },
    { href: '/team', label: t.t('nav.team') },
    { href: '/kyc', label: t.t('nav.kyc') },
  ];

  return (
    <nav className="kv-sidebar" aria-label={t.t('nav.primary')}>
      <Link href="/dashboard" className="kv-brand">{env.appName}</Link>
      {me && <p className="kv-sidebar__who">{me.displayName ?? me.id}</p>}
      <ul className="kv-sidebar__nav">
        {nav.map((n) => <li key={n.href}><Link href={n.href} className="kv-sidebar__link">{n.label}</Link></li>)}
      </ul>
      <div className="kv-sidebar__foot">
        <LocaleSwitcher active={lang} label={t.t('lang.label')} />
        <form action="/api/session" method="post">
          <input type="hidden" name="_action" value="logout" />
          <button type="submit" className="kv-btn kv-btn--muted">{t.t('nav.signOut')}</button>
        </form>
      </div>
    </nav>
  );
}
