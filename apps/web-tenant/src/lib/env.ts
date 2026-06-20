// apps/web-tenant/src/lib/env.ts · the ONLY env reader. The tenant console is an AUTHENTICATED app — still no
// secrets in the browser bundle (only NEXT_PUBLIC_* reaches the client). Fails closed if the API origin is unset.
const publicApiUrl = process.env.NEXT_PUBLIC_API_URL;
if (!publicApiUrl) throw new Error('web-tenant: NEXT_PUBLIC_API_URL is required');

export const env = {
  publicApiUrl,
  serverApiUrl: process.env.API_URL_INTERNAL || publicApiUrl,   // server-side SSR origin (never shipped)
  appName: 'Krishi-Verse Console',
} as const;
