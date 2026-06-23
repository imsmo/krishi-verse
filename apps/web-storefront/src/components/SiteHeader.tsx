// apps/web-storefront/src/components/SiteHeader.tsx · the global storefront header (server component — no client
// JS beyond the locale switcher). Brand, primary nav, the language picker, a cart link with a count badge, and
// a sign-in link. All copy via the i18n translator; the cart count is passed in (0 until the cart lands in
// SF-W3). The `/cart` and `/login` targets are real routes built in later waves; until then the shared
// not-found boundary renders a friendly localized 404 (degrade, never die).
import Link from 'next/link';
import { getTranslator, getLang } from '../lib/i18n';
import { LocaleSwitcher } from './LocaleSwitcher';
import { env } from '../lib/env';

export function SiteHeader({ cartCount = 0 }: { cartCount?: number }) {
  const t = getTranslator();
  const lang = getLang();
  const nav = [
    { href: '/', label: t.t('nav.home') },
    { href: '/pricing', label: t.t('nav.pricing') },
    { href: '/about', label: t.t('nav.about') },
    { href: '/help', label: t.t('nav.help') },
  ];
  return (
    <header className="kv-header">
      <div className="kv-container kv-header__bar">
        <Link href="/" className="kv-header__brand">{env.appName}</Link>
        <nav className="kv-header__nav" aria-label={t.t('nav.primary')}>
          {nav.map((n) => <Link key={n.href} href={n.href} className="kv-header__link">{n.label}</Link>)}
        </nav>
        <div className="kv-header__actions">
          <LocaleSwitcher active={lang} label={t.t('lang.label')} />
          <Link href="/cart" className="kv-header__cart" aria-label={t.t('nav.cart')}>
            {t.t('nav.cart')}{cartCount > 0 && <span className="kv-header__badge" aria-hidden="true">{cartCount}</span>}
          </Link>
          <Link href="/login" className="kv-header__login">{t.t('nav.login')}</Link>
        </div>
      </div>
    </header>
  );
}
