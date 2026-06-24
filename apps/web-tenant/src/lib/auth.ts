// apps/web-tenant/src/lib/auth.ts · session cookies for the authenticated console. The access + refresh tokens
// live in HTTPONLY, Secure, SameSite=Lax cookies — unreadable to JS (XSS can't steal them); the SDK reads the
// access token only during SSR. These are low-level cookie helpers; the session GATE + silent refresh live in
// lib/session.ts (kept apart to avoid an import cycle with lib/api-client, which imports this file). The API
// re-enforces RBAC on every call, so the cookie is convenience, never the authority (defence in depth, Law 1/4).
import 'server-only';
import { cookies } from 'next/headers';

export const ACCESS_COOKIE = 'kvt_access';
export const REFRESH_COOKIE = 'kvt_refresh';
const OPTS = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };
const REFRESH_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

/** Server-only: the current access token (or undefined when the access cookie is absent/expired). */
export function getAccessToken(): string | undefined { return cookies().get(ACCESS_COOKIE)?.value; }
/** Server-only: the current refresh token (used only to mint a new access token server-side). */
export function getRefreshToken(): string | undefined { return cookies().get(REFRESH_COOKIE)?.value; }

/** Persist a freshly-issued token pair (after login / refresh). Access cookie lifetime tracks the token's TTL. */
export function setSession(accessToken: string, refreshToken: string, accessMaxAgeSec: number): void {
  const c = cookies();
  c.set(ACCESS_COOKIE, accessToken, { ...OPTS, maxAge: Math.max(1, accessMaxAgeSec) });
  c.set(REFRESH_COOKIE, refreshToken, { ...OPTS, maxAge: REFRESH_MAX_AGE_SEC });
}
export function clearSession(): void { const c = cookies(); c.delete(ACCESS_COOKIE); c.delete(REFRESH_COOKIE); }

/** Cheap presence check (no network) — true if either cookie is set. Used by the shell to pick chrome vs bare. */
export function hasSessionCookie(): boolean { return !!getAccessToken() || !!getRefreshToken(); }
