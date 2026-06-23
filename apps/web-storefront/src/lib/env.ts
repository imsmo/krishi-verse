// apps/web-storefront/src/lib/env.ts · the ONLY place env is read in the storefront. PUBLIC site → NO secrets
// in the client bundle: only NEXT_PUBLIC_* values (the API origin) are exposed to the browser; a server-only
// internal API URL (for SSR fetches that stay inside the cluster) is read on the server and never shipped.
// Fails closed: a missing API origin throws at module load rather than rendering a broken site.
const publicApiUrl = process.env.NEXT_PUBLIC_API_URL;
if (!publicApiUrl) throw new Error('web-storefront: NEXT_PUBLIC_API_URL is required');

export const env = {
  /** Browser-visible API origin (used by client components). */
  publicApiUrl,
  /** Server-side API origin for SSR (internal DNS if set, else the public one). Never sent to the browser. */
  serverApiUrl: process.env.API_URL_INTERNAL || publicApiUrl,
  /** Origin of the seller/tenant console (web-tenant); the "Sell on Krishi-Verse" CTA links here. An origin,
   *  not a secret — safe to expose. Null when unset → the CTA falls back to in-app sign-in. */
  tenantAppUrl: process.env.NEXT_PUBLIC_TENANT_APP_URL || null,
  appName: 'Krishi-Verse',
} as const;
