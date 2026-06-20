// apps/web-partner/src/lib/partner-auth.ts · session handling for the partner portal. Access + refresh tokens
// live in HTTPONLY, Secure, SameSite=Lax cookies — unreadable to JS (XSS can't steal them); the SDK reads the
// access token only during SSR. requirePartner() gates protected server components (redirects to /login). The
// API re-enforces partner-scoped RBAC on every call, so the cookie is convenience, never the authority — a
// partner only ever sees applications routed to them (defence in depth, Law 1/4 server-side).
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const ACCESS_COOKIE = 'kvp_access';
export const REFRESH_COOKIE = 'kvp_refresh';
const OPTS = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };

export function getAccessToken(): string | undefined { return cookies().get(ACCESS_COOKIE)?.value; }
export function setSession(accessToken: string, refreshToken: string, accessMaxAgeSec: number): void {
  cookies().set(ACCESS_COOKIE, accessToken, { ...OPTS, maxAge: accessMaxAgeSec });
  cookies().set(REFRESH_COOKIE, refreshToken, { ...OPTS, maxAge: 60 * 60 * 24 * 30 });
}
export function clearSession(): void { cookies().delete(ACCESS_COOKIE); cookies().delete(REFRESH_COOKIE); }
export function isAuthenticated(): boolean { return !!getAccessToken(); }
/** Server-only guard for protected pages. */
export function requirePartner(): void { if (!isAuthenticated()) redirect('/login'); }
