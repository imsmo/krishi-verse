// apps/web-tenant/src/lib/env.ts · the ONLY env reader. The tenant console is an AUTHENTICATED app — still no
// secrets in the browser bundle (only NEXT_PUBLIC_* reaches the client). Fails closed if the API origin is unset.
const publicApiUrl = process.env.NEXT_PUBLIC_API_URL;
if (!publicApiUrl) throw new Error('web-tenant: NEXT_PUBLIC_API_URL is required');

export const env = {
  publicApiUrl,
  serverApiUrl: process.env.API_URL_INTERNAL || publicApiUrl,   // server-side SSR origin (never shipped)
  appName: 'Krishi-Verse Console',
  /** Console visibility switch for the auctions surface (hidden when 'false'). Enabled by default; the API's own
   *  `auctions` flag is the authoritative gate (if it's off, the reads simply degrade to an empty state). */
  featureAuctions: process.env.NEXT_PUBLIC_FEATURE_AUCTIONS !== 'false',
} as const;
