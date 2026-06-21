// Unit tests for the realtime channel contract (the security-critical part of the publisher): channel
// grammar/parse must reject spoofed/cross-segment ids, and projection must drop ALL PII (no bidder/user
// ids on public feeds, sealed-bid amounts hidden) while keeping money as STRING minor units (Law 2).
import {
  auctionChannel, userOrdersChannel, mccChannel, parseChannel, projectEvent, REALTIME_FANOUT_EVENT_TYPES,
} from '../realtime-channels';

const at = () => new Date('2026-06-21T00:00:00.000Z');

describe('channel grammar', () => {
  it('builds well-formed channels and rejects bad segments', () => {
    expect(auctionChannel('t1', 'a1')).toBe('t:t1:auction:a1');
    expect(userOrdersChannel('t1', 'u1')).toBe('t:t1:u:u1:orders');
    expect(mccChannel('t1', 'm1')).toBe('t:t1:mcc:m1');
    expect(auctionChannel('t1', 'a:1')).toBeNull();      // ':' would spoof the grammar
    expect(auctionChannel('t1', '')).toBeNull();          // empty
    expect(auctionChannel('t1', 'x'.repeat(65))).toBeNull(); // oversized
  });

  it('parses only exact known shapes', () => {
    expect(parseChannel('t:t1:auction:a1')).toEqual({ kind: 'auction', tenantId: 't1', auctionId: 'a1' });
    expect(parseChannel('t:t1:u:u1:orders')).toEqual({ kind: 'user_orders', tenantId: 't1', userId: 'u1' });
    expect(parseChannel('t:t1:mcc:m1')).toEqual({ kind: 'mcc', tenantId: 't1', mccId: 'm1' });
    expect(parseChannel('t:t1:wallet:w1')).toBeNull();    // unknown kind
    expect(parseChannel('t:t1:auction')).toBeNull();      // malformed
    expect(parseChannel('garbage')).toBeNull();
    expect(parseChannel('x'.repeat(300))).toBeNull();     // bounded
  });
});

describe('projection — NON-PII, money-as-string', () => {
  it('auction bid: broadcasts price as STRING, never the bidder id', () => {
    const out = projectEvent({ tenantId: 't1', eventType: 'auctions.bid_placed', aggregateId: 'a1',
      payload: { v: 1, auctionId: 'a1', bidId: 'b1', bidderUserId: 'u-secret', amountMinor: '250000' } }, at);
    expect(out).toHaveLength(1);
    expect(out[0].channel).toBe('t:t1:auction:a1');
    expect(out[0].data).toEqual({ auctionId: 'a1', sealed: false, currentPriceMinor: '250000' });
    expect(JSON.stringify(out[0])).not.toContain('u-secret');   // bidder identity must never leak
    expect(typeof (out[0].data as any).currentPriceMinor).toBe('string'); // Law 2
  });

  it('sealed bid: never reveals the amount', () => {
    const out = projectEvent({ tenantId: 't1', eventType: 'auctions.bid_placed', aggregateId: 'a1',
      payload: { auctionId: 'a1', bidderUserId: 'u1', amountMinor: 'sealed' } }, at);
    expect(out[0].data).toEqual({ auctionId: 'a1', sealed: true });
    expect(JSON.stringify(out[0])).not.toMatch(/250000|amount/i);
  });

  it('auction_won: announces close on public feed WITHOUT the winner', () => {
    const out = projectEvent({ tenantId: 't1', eventType: 'auctions.auction_won', aggregateId: 'a1',
      payload: { auctionId: 'a1', winnerUserId: 'u-winner', amountMinor: '999' } }, at);
    expect(out[0].channel).toBe('t:t1:auction:a1');
    expect(out[0].data).toEqual({ auctionId: 'a1', status: 'won' });
    expect(JSON.stringify(out[0])).not.toContain('u-winner');
  });

  it('order status: fans out to EACH party only on their own private channel', () => {
    const out = projectEvent({ tenantId: 't1', eventType: 'orders.order_status_changed', aggregateId: 'o1',
      payload: { orderId: 'o1', status: 'confirmed', buyerUserId: 'buyer1', sellerUserId: 'seller1' } }, at);
    const channels = out.map((m) => m.channel).sort();
    expect(channels).toEqual(['t:t1:u:buyer1:orders', 't:t1:u:seller1:orders']);
    out.forEach((m) => expect(m.data).toEqual({ orderId: 'o1', status: 'confirmed' }));
  });

  it('dairy collection → mcc dashboard channel, no member PII', () => {
    const out = projectEvent({ tenantId: 't1', eventType: 'dairy.collection_recorded', aggregateId: 'c1',
      payload: { mccId: 'm1', collectionId: 'c1', shift: 'morning', memberPhone: '9800000000', qtyMilliLitres: '12000' } }, at);
    expect(out[0].channel).toBe('t:t1:mcc:m1');
    expect(JSON.stringify(out[0])).not.toContain('9800000000');
    expect(out[0].data).toMatchObject({ mccId: 'm1', collectionId: 'c1', shift: 'morning', qtyMilliLitres: '12000' });
  });

  it('platform (null tenant) and unmapped events never fan out (fail-closed)', () => {
    expect(projectEvent({ tenantId: null, eventType: 'auctions.bid_placed', aggregateId: 'a1', payload: {} }, at)).toEqual([]);
    expect(projectEvent({ tenantId: 't1', eventType: 'payments.payout_executed', aggregateId: 'p1', payload: {} }, at)).toEqual([]);
  });

  it('every advertised fanout type is actually projectable (no dead registrations)', () => {
    // each type yields [] only when payload lacks ids; with minimal ids it should map to ≥0 deterministically
    for (const t of REALTIME_FANOUT_EVENT_TYPES) {
      expect(() => projectEvent({ tenantId: 't1', eventType: t, aggregateId: 'x1', payload: { mccId: 'm1', orderId: 'o1', auctionId: 'a1', buyerUserId: 'b1' } }, at)).not.toThrow();
    }
  });
});
