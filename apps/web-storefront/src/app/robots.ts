// apps/web-storefront/src/app/robots.ts · robots.txt (App Router metadata route). Crawlers may index the public
// catalogue/marketing/trace surfaces, but the authenticated + transactional areas (account, cart, checkout,
// orders, offers, messages, notifications, login) and the API route handlers are disallowed — they hold private,
// per-user state with no SEO value. The sitemap pointer is emitted only when the site origin is configured.
import type { MetadataRoute } from 'next';
import { env } from '../lib/env';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/account', '/cart', '/checkout', '/orders', '/offers', '/messages', '/notifications', '/login', '/api/'],
    },
    ...(env.siteUrl ? { sitemap: `${env.siteUrl}/sitemap.xml` } : {}),
  };
}
