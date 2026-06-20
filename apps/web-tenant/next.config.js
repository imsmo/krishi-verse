// apps/web-tenant/next.config.js · seller/tenant console. transpilePackages compiles the workspace TS packages
// the app imports. Strict security headers; never indexed (also enforced per-page via metadata.robots).
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@krishi-verse/sdk-js', '@krishi-verse/i18n', '@krishi-verse/tokens'],
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    }];
  },
};
module.exports = nextConfig;
