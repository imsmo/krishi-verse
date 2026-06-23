// apps/web-storefront/src/components/SiteFooter.tsx · the global footer (server component). Three link columns
// (company / support / sellers) + tagline + copyright. All copy via the i18n translator; the year is computed
// server-side. Links point at the real storefront routes (built across the waves).
import Link from 'next/link';
import { getTranslator } from '../lib/i18n';
import { env } from '../lib/env';

export function SiteFooter() {
  const t = getTranslator();
  const cols: { heading: string; links: { href: string; label: string }[] }[] = [
    { heading: t.t('footer.col.company'), links: [
      { href: '/about', label: t.t('nav.about') },
      { href: '/blog', label: t.t('nav.blog') },
      { href: '/press', label: t.t('nav.press') },
    ] },
    { heading: t.t('footer.col.support'), links: [
      { href: '/help', label: t.t('nav.help') },
      { href: '/pricing', label: t.t('nav.pricing') },
    ] },
    { heading: t.t('footer.col.sellers'), links: [
      { href: '/tenants-signup', label: t.t('nav.signup') },
    ] },
  ];
  return (
    <footer className="kv-footer">
      <div className="kv-container">
        <p className="kv-footer__tagline">{t.t('footer.tagline')}</p>
        <div className="kv-footer__cols">
          {cols.map((c) => (
            <nav key={c.heading} className="kv-footer__col" aria-label={c.heading}>
              <h2 className="kv-footer__heading">{c.heading}</h2>
              {c.links.map((l) => <Link key={l.href} href={l.href} className="kv-footer__link">{l.label}</Link>)}
            </nav>
          ))}
        </div>
        <p className="kv-footer__rights">{t.t('footer.rights', { year: new Date().getFullYear(), app: env.appName })}</p>
      </div>
    </footer>
  );
}
