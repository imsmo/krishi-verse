// core/realtime/realtime-channels.ts
// THE realtime contract — CANONICAL source (the gateway mirrors the grammar in
// apps/realtime-gateway/src/channels/contract.ts; keep them in sync). Pure, framework-free, no I/O.
//
// Two jobs live here, and ONLY here, so the security boundary is unit-provable:
//  1) CHANNEL GRAMMAR — the string a socket subscribes to. The tenant id is the FIRST segment so the
//     gateway can reject cross-tenant subscriptions by string compare alone (defense in depth, §4).
//       t:{tenantId}:auction:{auctionId}   — auction live feed   (any same-tenant member may watch)
//       t:{tenantId}:u:{userId}:orders     — a user's order timeline (ONLY that user)
//       t:{tenantId}:mcc:{mccId}           — dairy collection dashboard (operator: dairy.manage)
//  2) PROJECTION — turning an outbox event into the EXACT bytes that cross to clients. This is where PII
//     is dropped: no phone/email/name, no counterparty user ids on shared channels, sealed-bid amounts
//     never revealed. Money stays a STRING in minor units (Law 2 — never a float). If an event maps to
//     nothing publishable, projection returns null and the publisher skips it (fail-closed).
//
// Why redact at the SOURCE: the bytes we put on Redis are the bytes the gateway forwards. Anything we
// don't want a spectator to see must never be published, not merely "filtered later".

/** A message as it will be sent to subscribed clients. `v` lets clients tolerate additive changes. */
export interface RealtimeMessage {
  v: 1;
  channel: string;
  type: string;                       // the source eventType (e.g. 'auctions.bid_placed')
  at: string;                         // ISO publish time (gateway/clients may show "live N ago")
  data: Record<string, unknown>;      // already NON-PII; money is string minor units
}

const SEG = /^[A-Za-z0-9_-]{1,64}$/;  // one channel segment: bounded, no ':' so the grammar can't be spoofed

function seg(v: unknown): string | null {
  const s = typeof v === 'string' ? v : v == null ? '' : String(v);
  return SEG.test(s) ? s : null;      // reject empty / oversized / separator-bearing ids (anti-injection)
}

/* ----------------------------- channel builders ----------------------------- */
export function auctionChannel(tenantId: string, auctionId: string): string | null {
  const t = seg(tenantId), a = seg(auctionId);
  return t && a ? `t:${t}:auction:${a}` : null;
}
export function userOrdersChannel(tenantId: string, userId: string): string | null {
  const t = seg(tenantId), u = seg(userId);
  return t && u ? `t:${t}:u:${u}:orders` : null;
}
export function mccChannel(tenantId: string, mccId: string): string | null {
  const t = seg(tenantId), m = seg(mccId);
  return t && m ? `t:${t}:mcc:${m}` : null;
}

/** Parsed channel — the gateway authorizes against this; kept here so grammar lives in one place. */
export type ParsedChannel =
  | { kind: 'auction'; tenantId: string; auctionId: string }
  | { kind: 'user_orders'; tenantId: string; userId: string }
  | { kind: 'mcc'; tenantId: string; mccId: string };

/** Parse a client-supplied channel string. Returns null for anything that isn't an exact, known shape. */
export function parseChannel(channel: string): ParsedChannel | null {
  if (typeof channel !== 'string' || channel.length > 256) return null;
  const p = channel.split(':');
  // t:{tid}:auction:{aid}
  if (p.length === 4 && p[0] === 't' && p[2] === 'auction') {
    const t = seg(p[1]), a = seg(p[3]);
    return t && a ? { kind: 'auction', tenantId: t, auctionId: a } : null;
  }
  // t:{tid}:u:{uid}:orders
  if (p.length === 5 && p[0] === 't' && p[2] === 'u' && p[4] === 'orders') {
    const t = seg(p[1]), u = seg(p[3]);
    return t && u ? { kind: 'user_orders', tenantId: t, userId: u } : null;
  }
  // t:{tid}:mcc:{mid}
  if (p.length === 4 && p[0] === 't' && p[2] === 'mcc') {
    const t = seg(p[1]), m = seg(p[3]);
    return t && m ? { kind: 'mcc', tenantId: t, mccId: m } : null;
  }
  return null;
}

/* ------------------------------- projection -------------------------------- */
/** A relayed outbox event, projected to (channel, message) pairs. Shaped to match core/outbox OutboxEvent
 *  without importing it (this file stays dependency-free for the gateway mirror + unit tests). */
export interface ProjectableEvent {
  tenantId: string | null;
  eventType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
}

function str(v: unknown): string | undefined { return typeof v === 'string' && v.length <= 128 ? v : undefined; }

/** Map an event to the realtime messages it should fan out. Returns [] if nothing is publishable.
 *  EVERYTHING returned is already NON-PII. */
export function projectEvent(ev: ProjectableEvent, now: () => Date = () => new Date()): RealtimeMessage[] {
  const at = now().toISOString();
  const tenantId = ev.tenantId;
  if (!tenantId) return [];                               // realtime is tenant-scoped; platform events don't fan out
  const p = ev.payload ?? {};
  const mk = (channel: string | null, data: Record<string, unknown>): RealtimeMessage[] =>
    channel ? [{ v: 1, channel, type: ev.eventType, at, data }] : [];

  switch (ev.eventType) {
    /* ---- auctions: public-within-tenant live feed (NO bidder identity, sealed amount hidden) ---- */
    case 'auctions.bid_placed': {
      const auctionId = str(p.auctionId) ?? ev.aggregateId;
      // amountMinor is already 'sealed' (string) for sealed auctions at emit; pass through verbatim,
      // but NEVER include bidderUserId — spectators must not learn who bid.
      const amountMinor = p.amountMinor === 'sealed' ? null : str(p.amountMinor);
      return mk(auctionChannel(tenantId, auctionId), {
        auctionId,
        sealed: p.amountMinor === 'sealed',
        ...(amountMinor ? { currentPriceMinor: amountMinor } : {}),  // string minor units (Law 2)
      });
    }
    case 'auctions.auction_extended':
    case 'auctions.auction_opened':
    case 'auctions.auction_ended':
    case 'auctions.auction_failed_reserve':
    case 'auctions.auction_cancelled': {
      const auctionId = str(p.auctionId) ?? ev.aggregateId;
      const endsAt = str(p.endsAt);
      const status = ev.eventType.replace('auctions.auction_', '').replace('auctions.', '');
      return mk(auctionChannel(tenantId, auctionId), { auctionId, status, ...(endsAt ? { endsAt } : {}) });
    }
    case 'auctions.auction_won': {
      // The WIN result is private (winner identity) — announce only that the auction closed on the public
      // feed; do NOT broadcast the winner. Winner is told via their order channel when the order is created.
      const auctionId = str(p.auctionId) ?? ev.aggregateId;
      return mk(auctionChannel(tenantId, auctionId), { auctionId, status: 'won' });
    }

    /* ---- orders: PRIVATE per-buyer/seller timeline (only the owning user's channel) ---- */
    case 'orders.order_status_changed':
    case 'orders.order_confirmed':
    case 'orders.order_packed':
    case 'orders.order_ready':
    case 'orders.order_out_for_delivery':
    case 'orders.order_delivered':
    case 'orders.order_completed':
    case 'orders.order_cancelled':
    case 'orders.order_refunded':
    case 'orders.order_partially_refunded': {
      const orderId = str(p.orderId) ?? ev.aggregateId;
      const status = str(p.status) ?? ev.eventType.replace('orders.order_', '');
      const data = { orderId, status };
      // Fan out to whichever party ids the event carries — each only to THAT user's own channel.
      const out: RealtimeMessage[] = [];
      const buyerId = str(p.buyerUserId);
      const sellerId = str(p.sellerUserId);
      if (buyerId) out.push(...mk(userOrdersChannel(tenantId, buyerId), data));
      if (sellerId) out.push(...mk(userOrdersChannel(tenantId, sellerId), data));
      return out;
    }

    /* ---- dairy: operator collection dashboard (aggregate counters, no member PII) ---- */
    case 'dairy.collection_recorded': {
      const mccId = str(p.mccId);
      if (!mccId) return [];
      return mk(mccChannel(tenantId, mccId), {
        mccId,
        collectionId: str(p.collectionId) ?? ev.aggregateId,
        shift: str(p.shift),
        // quantity is operational telemetry, not PII; keep as string if present (no float)
        ...(str(p.qtyMilliLitres) ? { qtyMilliLitres: str(p.qtyMilliLitres) } : {}),
      });
    }
    case 'dairy.bill_paid': {
      const mccId = str(p.mccId);
      if (!mccId) return [];
      return mk(mccChannel(tenantId, mccId), { mccId, event: 'bill_paid', cycleId: str(p.cycleId) });
    }

    default:
      return [];   // unmapped events never fan out (fail-closed)
  }
}

/** The set of event types the publisher subscribes to. Derived so the module registers exactly these. */
export const REALTIME_FANOUT_EVENT_TYPES: readonly string[] = [
  'auctions.bid_placed',
  'auctions.auction_opened',
  'auctions.auction_extended',
  'auctions.auction_ended',
  'auctions.auction_failed_reserve',
  'auctions.auction_cancelled',
  'auctions.auction_won',
  'orders.order_status_changed',
  'orders.order_confirmed',
  'orders.order_packed',
  'orders.order_ready',
  'orders.order_out_for_delivery',
  'orders.order_delivered',
  'orders.order_completed',
  'orders.order_cancelled',
  'orders.order_refunded',
  'orders.order_partially_refunded',
  'dairy.collection_recorded',
  'dairy.bill_paid',
];
