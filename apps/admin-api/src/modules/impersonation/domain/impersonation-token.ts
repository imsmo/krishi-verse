// apps/admin-api/src/modules/impersonation/domain/impersonation-token.ts · the act-as token (pure, dependency-free
// HS256 — same posture as core/auth/admin-jwt.strategy). SECURITY by construction:
//   • signed with a DEDICATED secret (IMPERSONATION_TOKEN_SECRET) — NOT the admin JWT secret, NOT the user access
//     secret. The god-mode realm never holds the production user-signing key, and this token can't be minted
//     elsewhere.
//   • typ = 'impersonation' (NEVER 'access') + a separate iss/aud — an un-upgraded apps/api verifyAccessToken
//     (which requires typ==='access' and a different secret) CANNOT accept it ⇒ fail-closed: until apps/api adds
//     an impersonation-aware verifier (enforcing read-only + auditing the actor), the token simply does nothing.
//   • carries the RFC-8693 `act` (actor) claim = the impersonating admin, the grant `jti`, the `scope`
//     ('read_only'), and a SHORT `exp` (time-box). No perms array is embedded — the honouring API derives
//     read-only access from the scope; there is no channel to money/god/write.
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface ImpersonationTokenClaims {
  iss: string; aud: string;
  sub: string;            // target (impersonated) user id
  tid: string;            // target tenant id
  act: { sub: string };   // the actor = impersonating admin (RFC 8693)
  jti: string;            // grant id — revoking/ending the grant invalidates this token server-side
  scope: 'read_only';
  typ: 'impersonation';
  iat: number; exp: number;
}

export class ImpersonationTokenError extends Error { constructor(msg: string) { super(msg); this.name = 'ImpersonationTokenError'; } }

const b64url = (buf: Buffer) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

export interface MintInput {
  secret: string; issuer: string; audience: string;
  grantId: string; adminUserId: string; targetUserId: string; targetTenantId: string;
  ttlSec: number; nowSec?: number;
}

/** Mint a short-lived, read-only act-as token. */
export function mintImpersonationToken(input: MintInput): { token: string; expSec: number } {
  const now = input.nowSec ?? Math.floor(Date.now() / 1000);
  const exp = now + input.ttlSec;
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload: ImpersonationTokenClaims = {
    iss: input.issuer, aud: input.audience, sub: input.targetUserId, tid: input.targetTenantId,
    act: { sub: input.adminUserId }, jti: input.grantId, scope: 'read_only', typ: 'impersonation', iat: now, exp,
  };
  const h = b64url(Buffer.from(JSON.stringify(header)));
  const p = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(createHmac('sha256', input.secret).update(`${h}.${p}`).digest());
  return { token: `${h}.${p}.${sig}`, expSec: exp };
}

/** Verify + decode an act-as token (reference impl; apps/api uses the same logic). Throws on any failure. */
export function verifyImpersonationToken(token: string, secret: string, issuer: string, audience: string, nowSec = Math.floor(Date.now() / 1000)): ImpersonationTokenClaims {
  if (!token) throw new ImpersonationTokenError('missing token');
  const parts = token.split('.');
  if (parts.length !== 3) throw new ImpersonationTokenError('malformed token');
  const [h, p, s] = parts;
  let header: any; let payload: any;
  try { header = JSON.parse(fromB64url(h).toString('utf8')); payload = JSON.parse(fromB64url(p).toString('utf8')); }
  catch { throw new ImpersonationTokenError('undecodable token'); }
  if (header?.alg !== 'HS256') throw new ImpersonationTokenError('unexpected alg');       // pin alg — no confusion
  const expected = createHmac('sha256', secret).update(`${h}.${p}`).digest();
  const given = fromB64url(s);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw new ImpersonationTokenError('bad signature');
  if (payload.typ !== 'impersonation') throw new ImpersonationTokenError('not an impersonation token');
  if (payload.iss !== issuer) throw new ImpersonationTokenError('bad issuer');
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(audience)) throw new ImpersonationTokenError('bad audience');
  if (typeof payload.exp !== 'number' || payload.exp <= nowSec) throw new ImpersonationTokenError('token expired');
  if (!payload.sub || !payload.act?.sub || !payload.jti) throw new ImpersonationTokenError('missing required claims');
  if (payload.scope !== 'read_only') throw new ImpersonationTokenError('non read-only scope refused');
  return payload as ImpersonationTokenClaims;
}
