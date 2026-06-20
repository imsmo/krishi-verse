// apps/web-admin/src/lib/admin-auth.ts · god-mode session. The admin access token (issued by the admin IdP
// AFTER a FIDO2/hardware-key ceremony — that strong-auth flow lives in the IdP, not in this UI) is held in an
// HTTPONLY, Secure, SameSite=Strict cookie (Strict, not Lax — no cross-site navigation should carry a god-mode
// token). admin-api independently re-enforces owner-RBAC + hardware-key + step-up on every call, so this cookie
// is convenience, never the authority. requireAdmin() gates server components.
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const ADMIN_COOKIE = 'kva_session';
const OPTS = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/' };

export function getAdminToken(): string | undefined { return cookies().get(ADMIN_COOKIE)?.value; }
export function setAdminSession(token: string, maxAgeSec: number): void { cookies().set(ADMIN_COOKIE, token, { ...OPTS, maxAge: maxAgeSec }); }
export function clearAdminSession(): void { cookies().delete(ADMIN_COOKIE); }
export function isAdminAuthenticated(): boolean { return !!getAdminToken(); }
export function requireAdmin(): void { if (!isAdminAuthenticated()) redirect('/login'); }
