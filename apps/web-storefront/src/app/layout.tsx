// apps/web-storefront/src/app/layout.tsx · root layout. Sets the document language + direction from the active
// locale (kv_lang cookie → Accept-Language), applies the design-token font/colors via globals.css, and renders
// the shared SiteHeader + SiteFooter. Server component (the only client JS in the shell is the locale switcher's
// tiny form). Default SEO metadata.
import type { Metadata } from 'next';
import '../styles/globals.css';
import { env } from '../lib/env';
import { getLanguageDef } from '../lib/i18n';
import { SiteHeader } from '../components/SiteHeader';
import { SiteFooter } from '../components/SiteFooter';

export const metadata: Metadata = {
  title: { default: `${env.appName} — fresh from the farm`, template: `%s · ${env.appName}` },
  description: 'Krishi-Verse: a multi-tenant agri-commerce marketplace connecting farmers, traders and buyers.',
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = getLanguageDef();
  return (
    <html lang={lang.code} dir={lang.dir}>
      <body>
        <a href="#main" className="kv-skip">Skip to content</a>
        <SiteHeader />
        <main className="kv-container" id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
