// apps/realtime-gateway/src/auth/socket-auth.guard.ts · authenticate a connecting socket by verifying the
// SAME short-lived access JWT the api mints (HS256, iss/aud pinned — never trust 'alg' from the token). The
// gateway is read-only fan-out, so it only needs identity (sub/tid/perms) to authorize subscriptions; it
// performs no mutations. Returns null on ANY problem (fail closed → the connection is refused).
import * as jwt from 'jsonwebtoken';
import type { SocketClaims } from './channel-authz';

export interface JwtVerifyConfig { accessSecret: string; issuer: string; audience: string }

/** Extract a bearer token from the handshake: Authorization header OR ?token= query param (browsers can't
 *  set WS headers, so the query param is the standard fallback; it's a short-lived access token). */
export function extractToken(headerAuth: string | undefined, url: string | undefined): string | null {
  if (headerAuth && /^Bearer\s+(.+)$/i.test(headerAuth)) return headerAuth.replace(/^Bearer\s+/i, '').trim();
  if (url) {
    const q = url.indexOf('?');
    if (q >= 0) {
      const tok = new URLSearchParams(url.slice(q + 1)).get('token');
      if (tok) return tok.trim();
    }
  }
  return null;
}

/** Verify an access token → SocketClaims, or null. Pins HS256 + iss/aud; rejects non-access tokens. */
export function verifyToken(token: string, cfg: JwtVerifyConfig): SocketClaims | null {
  try {
    const c = jwt.verify(token, cfg.accessSecret, {
      issuer: cfg.issuer, audience: cfg.audience, algorithms: ['HS256'],
    }) as jwt.JwtPayload;
    if (c.typ !== 'access') return null;
    const sub = String(c.sub ?? '');
    const tid = String((c as Record<string, unknown>).tid ?? '');
    if (!sub || !tid) return null;
    const perms = Array.isArray((c as Record<string, unknown>).perms) ? ((c as Record<string, unknown>).perms as string[]) : [];
    return { sub, tid, perms };
  } catch {
    return null;   // expired / wrong sig / wrong alg / bad iss-aud → refuse
  }
}

/** One-shot handshake auth used by ws-server on 'connection'. */
export function authenticate(headerAuth: string | undefined, url: string | undefined, cfg: JwtVerifyConfig): SocketClaims | null {
  const token = extractToken(headerAuth, url);
  return token ? verifyToken(token, cfg) : null;
}
