// apps/web-tenant/src/lib/api-client.ts · the tenant SDK, wired with the console's session token (read
// server-side only). The API enforces tenant scoping + RBAC from the token, so the console can't see another
// tenant's data even if asked (Law 1/4 server-side). Anonymous client is used only for the OTP login flow.
import 'server-only';
import { createClient, KrishiVerseClient } from '@krishi-verse/sdk-js';
import { env } from './env';
import { getAccessToken } from './auth';

export function tenantClient(): KrishiVerseClient {
  return createClient({ baseUrl: env.serverApiUrl, getToken: () => getAccessToken(), userAgent: 'kv-web-tenant', timeoutMs: 8000 });
}
export function anonClient(): KrishiVerseClient {
  return createClient({ baseUrl: env.serverApiUrl, userAgent: 'kv-web-tenant', timeoutMs: 8000 });
}
