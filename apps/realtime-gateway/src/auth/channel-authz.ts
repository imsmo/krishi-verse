// apps/realtime-gateway/src/auth/channel-authz.ts · THE subscription authorization boundary (§4 — the first
// thing an attacker tests on a socket gateway: "can I subscribe to another tenant's / another user's feed?").
// Pure + dependency-free so every deny path is unit-proven. Decisions are made ONLY from the verified JWT
// claims (server-resolved at login — the socket never tells us who it is) + the parsed channel. FAIL CLOSED:
// anything not explicitly allowed is denied.
import { parseChannel } from '../channels/contract';

/** The subset of verified access-token claims the gateway needs (mirrors api AccessTokenClaims). */
export interface SocketClaims {
  sub: string;        // user id
  tid: string;        // tenant id
  perms: string[];    // permission codes; '*' = platform god-mode
}

export type AuthzResult = { ok: true } | { ok: false; reason: 'bad_channel' | 'cross_tenant' | 'not_owner' | 'forbidden' };

const GOD = '*';
const DAIRY_DASHBOARD_PERM = 'dairy.manage';

/** May this socket (these claims) subscribe to this channel? */
export function canSubscribe(claims: SocketClaims, channel: string): AuthzResult {
  const parsed = parseChannel(channel);
  if (!parsed) return { ok: false, reason: 'bad_channel' };

  // Tenant isolation FIRST — a socket may only ever touch its own tenant's channels (defense in depth:
  // the publisher only ever publishes to the right tenant, but we never rely on the client's string).
  if (parsed.tenantId !== claims.tid) return { ok: false, reason: 'cross_tenant' };

  switch (parsed.kind) {
    case 'auction':
      // Auction live feed is visible to any authenticated member of the tenant (spectating is public-in-tenant).
      return { ok: true };
    case 'user_orders':
      // A user's private order timeline — ONLY that user (no IDOR: ignore any id the client asserts).
      return parsed.userId === claims.sub ? { ok: true } : { ok: false, reason: 'not_owner' };
    case 'mcc':
      // Dairy operator dashboard — requires the operator permission (or god-mode).
      return claims.perms.includes(GOD) || claims.perms.includes(DAIRY_DASHBOARD_PERM)
        ? { ok: true }
        : { ok: false, reason: 'forbidden' };
    default:
      return { ok: false, reason: 'bad_channel' };
  }
}
