// apps/realtime-gateway/src/channels/contract.ts · the channel GRAMMAR (consumer side).
// MIRROR of apps/api/src/core/realtime/realtime-channels.ts (the canonical source the publisher uses) —
// keep the two in sync. Pure, dependency-free, so the subscription-authorization boundary is unit-provable.
// The tenant id is the first segment so a cross-tenant subscription can be rejected by string parse alone.

export type ParsedChannel =
  | { kind: 'auction'; tenantId: string; auctionId: string }
  | { kind: 'user_orders'; tenantId: string; userId: string }
  | { kind: 'mcc'; tenantId: string; mccId: string };

const SEG = /^[A-Za-z0-9_-]{1,64}$/;
function seg(v: string): string | null { return SEG.test(v) ? v : null; }

/** Parse a client-supplied channel string into a known shape, or null. Bounded length (anti-DoS). */
export function parseChannel(channel: string): ParsedChannel | null {
  if (typeof channel !== 'string' || channel.length > 256) return null;
  const p = channel.split(':');
  if (p.length === 4 && p[0] === 't' && p[2] === 'auction') {
    const t = seg(p[1]!), a = seg(p[3]!);
    return t && a ? { kind: 'auction', tenantId: t, auctionId: a } : null;
  }
  if (p.length === 5 && p[0] === 't' && p[2] === 'u' && p[4] === 'orders') {
    const t = seg(p[1]!), u = seg(p[3]!);
    return t && u ? { kind: 'user_orders', tenantId: t, userId: u } : null;
  }
  if (p.length === 4 && p[0] === 't' && p[2] === 'mcc') {
    const t = seg(p[1]!), m = seg(p[3]!);
    return t && m ? { kind: 'mcc', tenantId: t, mccId: m } : null;
  }
  return null;
}
