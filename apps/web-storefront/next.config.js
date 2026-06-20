// apps/web-storefront/next.config.js · public marketplace. transpilePackages compiles the workspace TS packages
// the app imports. Indexable (per-page metadata controls crawl); conservative security headers.
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@krishi-verse/sdk-js', '@krishi-verse/i18n', '@krishi-verse/tokens'],
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    }];
  },
};
module.exports = nextConfig;
