// apps/web-storefront/next.config.js · public marketplace. The workspace packages it imports (@krishi-verse/*)
// ship PRE-COMPILED CommonJS in their dist/, so Next consumes them directly. transpilePackages is intentionally
// NOT set: listing a pre-compiled CJS package there makes Next apply its Fast-Refresh transform (injecting
// `import.meta.webpackHot`) to a module webpack treats as CommonJS → "Cannot use 'import.meta' outside a module".
// Indexable (per-page metadata controls crawl); conservative security headers.
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // pnpm symlinks workspace packages into node_modules; without this, webpack canonicalizes them to their real
  // path under packages/, classifies them as app SOURCE, and applies dev Fast-Refresh (injecting
  // `import.meta.webpackHot`) to their pre-compiled CJS dist → "Cannot use 'import.meta' outside a module".
  // symlinks:false keeps the node_modules identity so they're consumed as ordinary (pre-built) deps, which
  // Fast-Refresh skips.
  webpack: (config) => { config.resolve.symlinks = false; return config; },
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
