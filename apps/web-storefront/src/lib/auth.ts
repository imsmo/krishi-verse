// apps/web-storefront/src/lib/auth.ts · session handling. The access token is kept in an HTTPONLY, Secure,
// SameSite=Lax cookie — so it is UNREADABLE to JavaScript (XSS can't exfiltrate it) and the SDK reads it only on
// the server during SSR. The browser never sees the raw token. (Login/refresh write this cookie from a Route
// Handler / Server Action that calls the SDK auth resource; clearing it logs out.)
import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'kv_session';
const COOKIE_OPTS = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };

/** Server-only: the current access token (or undefined when anonymous). */
export function getSessionToken(): string | undefined {
  return cookies().get(SESSION_COOKIE)?.value;
}
/** Set the session cookie (call from a Route Handler / Server Action after a successful login/refresh). */
export function setSession(token: string, maxAgeSec: number): void {
  cookies().set(SESSION_COOKIE, token, { ...COOKIE_OPTS, maxAge: maxAgeSec });
}
export function clearSession(): void {
  cookies().delete(SESSION_COOKIE);
}
export function isAuthenticated(): boolean { return !!getSessionToken(); }
