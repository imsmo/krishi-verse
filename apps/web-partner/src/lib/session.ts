// apps/web-partner/src/lib/session.ts · the partner portal's session gate. Builds on lib/partner-auth's cookies +
// the SDK auth resource:
//   - refreshSession(): when the access cookie has expired but a refresh cookie survives, mint a new token pair
//     server-side (the refresh token never reaches the browser) and re-write the cookies → silent refresh.
//   - requirePartner(): resolve a usable access token or redirect anonymous partners to /login, so a protected page
//     never renders before auth. The API still re-enforces partner RBAC + RLS on every call (defence in depth).
// Network calls are timeout-bounded by the SDK and wrapped so a flaky auth API degrades to "log in again" rather
// than 500-ing the portal (Law 12). Lives apart from lib/partner-auth.ts to avoid an import cycle with
// lib/api-client (which imports partner-auth for the access token).
import 'server-only';
import { redirect } from 'next/navigation';
import { anonClient } from './api-client';
import { getAccessToken, getRefreshToken, setSession, clearSession } from './partner-auth';

/** Mint a new access token from the refresh cookie. Returns the new access token, or null (clearing dead cookies). */
export async function refreshSession(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  try {
    const tokens = await anonClient().auth.refresh(refreshToken);
    setSession(tokens.accessToken, tokens.refreshToken, tokens.expiresInSec);
    return tokens.accessToken;
  } catch {
    clearSession(); // expired/rotated/invalid → send the partner back through login
    return null;
  }
}

/** Resolve a usable access token (refreshing silently if needed), or null when the visitor is anonymous. */
export async function resolveSessionToken(): Promise<string | null> {
  return getAccessToken() ?? (await refreshSession());
}

/** Server-only gate for protected pages + Server Actions: silently refreshes, else redirects to /login. */
export async function requirePartner(): Promise<void> {
  const token = await resolveSessionToken();
  if (!token) redirect('/login');
}
