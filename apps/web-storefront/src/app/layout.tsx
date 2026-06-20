// apps/web-storefront/src/app/layout.tsx · root layout. Sets the document language + applies the design-token
// font/colors via globals.css. Server component (no client JS shipped for the shell). Default SEO metadata.
import type { Metadata } from 'next';
import Link from 'next/link';
import '../styles/globals.css';
import { env } from '../lib/env';

export const metadata: Metadata = {
  title: { default: `${env.appName} — fresh from the farm`, template: `%s · ${env.appName}` },
  description: 'Krishi-Verse: a multi-tenant agri-commerce marketplace connecting farmers, traders and buyers.',
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="kv-header">
          <div className="kv-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Link href="/" style={{ fontWeight: 700, color: 'var(--kv-brand-700)' }}>{env.appName}</Link>
          </div>
        </header>
        <main className="kv-container">{children}</main>
        <footer className="kv-footer"><div className="kv-container" style={{ color: 'var(--kv-neutral-600)' }}>© {new Date().getFullYear()} {env.appName}</div></footer>
      </body>
    </html>
  );
}
