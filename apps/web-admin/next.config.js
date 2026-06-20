// apps/web-admin/next.config.js · god-mode console. No workspace package imports (it uses a dedicated
// admin-client), but transpilePackages is harmless and future-proof. Strict security headers; never indexed
// (also enforced per-page via metadata.robots).
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@krishi-verse/tokens'],
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
      ],
    }];
  },
};
module.exports = nextConfig;
