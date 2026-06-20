// apps/web-tenant/src/lib/auth.ts · session handling for the authenticated console. The access + refresh tokens
// live in HTTPONLY, Secure, SameSite=Lax cookies — unreadable to JS (XSS can't steal them); the SDK reads the
// access token only during SSR. requireSession() gates server components (redirects to /login when anonymous) —
// the API still re-enforces RBAC, so the cookie is convenience, never the authority (defence in depth).
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const ACCESS_COOKIE = 'kvt_access';
export const REFRESH_COOKIE = 'kvt_refresh';
const OPTS = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };

export function getAccessToken(): string | undefined { return cookies().get(ACCESS_COOKIE)?.value; }
export function setSession(accessToken: string, refreshToken: string, accessMaxAgeSec: number): void {
  cookies().set(ACCESS_COOKIE, accessToken, { ...OPTS, maxAge: accessMaxAgeSec });
  cookies().set(REFRESH_COOKIE, refreshToken, { ...OPTS, maxAge: 60 * 60 * 24 * 30 });
}
export function clearSession(): void { cookies().delete(ACCESS_COOKIE); cookies().delete(REFRESH_COOKIE); }
export function isAuthenticated(): boolean { return !!getAccessToken(); }
/** Server-only guard for protected pages. */
export function requireSession(): void { if (!isAuthenticated()) redirect('/login'); }
