// modules/auctions/repositories/auction.repository.ts
// All SQL for the auctions aggregate. tenant_id in EVERY query (Law 1) + RLS. The bid path locks the
// auction row (SELECT … FOR UPDATE) so concurrent bids serialize; other writes use the version
// optimistic lock. Reads on the replica; writes in the caller's tx. Job finders use SKIP LOCKED.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { Auction, AuctionProps, AuctionKind } from '../domain/auction.entity';
import { AuctionStatus } from '../domain/auction.state';

const COLS = `id, tenant_id, listing_id, kind, start_price_minor, reserve_price_minor, min_increment_minor,
  emd_minor, emd_pct_bps, starts_at, ends_at, auto_extend_secs, extend_trigger_secs, min_bidders,
  requires_seller_approval, status, winning_bid_id, settled_order_id, version, created_at`;
const big = (v: any) => (v == null ? null : BigInt(v));
function toDomain(r: any): Auction {
  return Auction.rehydrate({
    id: r.id, tenantId: r.tenant_id, listingId: r.listing_id, kind: r.kind as AuctionKind, startPriceMinor: BigInt(r.start_price_minor),
    reservePriceMinor: big(r.reserve_price_minor), minIncrementMinor: BigInt(r.min_increment_minor), emdMinor: BigInt(r.emd_minor),
    emdPctBps: r.emd_pct_bps, startsAt: r.starts_at, endsAt: r.ends_at, autoExtendSecs: r.auto_extend_secs, extendTriggerSecs: r.extend_trigger_secs,
    minBidders: r.min_bidders, requiresSellerApproval: r.requires_seller_approval, status: r.status as AuctionStatus,
    winningBidId: r.winning_bid_id, settledOrderId: r.settled_order_id, version: r.version, createdAt: r.created_at,
  });
}

@Injectable()
export class AuctionRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  async insert(tx: TxContext, a: Auction): Promise<void> {
    const p = a.toProps();
    await tx.query(
      `INSERT INTO auctions (id, tenant_id, listing_id, kind, start_price_minor, reserve_price_minor, min_increment_minor,
         emd_minor, emd_pct_bps, starts_at, ends_at, auto_extend_secs, extend_trigger_secs, min_bidders,
         requires_seller_approval, status, version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [p.id, p.tenantId, p.listingId, p.kind, p.startPriceMinor.toString(), p.reservePriceMinor?.toString() ?? null, p.minIncrementMinor.toString(),
       p.emdMinor.toString(), p.emdPctBps, p.startsAt, p.endsAt, p.autoExtendSecs, p.extendTriggerSecs, p.minBidders,
       p.requiresSellerApproval, p.status, p.version]);
  }

  /** Lock the auction row for the bid/close path (serializes concurrent bids). */
  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<Auction | null> {
    const r = await tx.query(`SELECT ${COLS} FROM auctions WHERE id=$1 AND tenant_id=$2 FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }

  /** Public-within-tenant read (auctions are visible to any tenant member). */
  async getVisible(tenantId: string, id: string): Promise<Auction | null> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM auctions WHERE id=$1 AND tenant_id=$2`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }

  /** Optimistic-locked update (version). 0 rows ⇒ concurrent modification. */
  async update(tx: TxContext, a: Auction): Promise<boolean> {
    const p = a.toProps();
    const r = await tx.query(
      `UPDATE auctions SET status=$3, ends_at=$4, winning_bid_id=$5, settled_order_id=$6, version=version+1, updated_at=now()
        WHERE id=$1 AND tenant_id=$2 AND version=$7`,
      [p.id, p.tenantId, p.status, p.endsAt, p.winningBidId, p.settledOrderId, p.version]);
    return (r.rowCount ?? 0) > 0;
  }

  async recordEvent(tx: TxContext, tenantId: string, auctionId: string, eventCode: string, meta: Record<string, unknown> = {}): Promise<void> {
    await tx.query(`INSERT INTO auction_events (tenant_id, auction_id, event_code, meta) VALUES ($1,$2,$3,$4::jsonb)`, [tenantId, auctionId, eventCode, JSON.stringify(meta)]);
  }

  async listFor(tenantId: string, opts: { status?: string; cursor?: { c: string; id: string }; limit: number }): Promise<Auction[]> {
    const params: unknown[] = [tenantId];
    let where = `tenant_id=$1`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (opts.status) where += ` AND status=${p(opts.status)}`;
    if (opts.cursor) { const cc = p(opts.cursor.c), ci = p(opts.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(opts.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM auctions WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }

  /** Worker finders (cross-tenant; run as kv_relay). Bounded + SKIP LOCKED. */
  async findDueToOpen(tx: TxContext, now: Date, limit: number): Promise<Auction[]> {
    const r = await tx.query(`SELECT ${COLS} FROM auctions WHERE status='scheduled' AND starts_at <= $1 ORDER BY starts_at LIMIT $2 FOR UPDATE SKIP LOCKED`, [now, limit]);
    return r.rows.map(toDomain);
  }
  async findDueToClose(tx: TxContext, now: Date, limit: number): Promise<Auction[]> {
    const r = await tx.query(`SELECT ${COLS} FROM auctions WHERE status IN ('live','extended') AND ends_at <= $1 ORDER BY ends_at LIMIT $2 FOR UPDATE SKIP LOCKED`, [now, limit]);
    return r.rows.map(toDomain);
  }
}
