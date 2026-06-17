// modules/auctions/repositories/bid.repository.ts
// All SQL for bids — APPEND-ONLY (DB grants revoke UPDATE/DELETE; history is physics). tenant_id in
// EVERY query (Law 1) + RLS. Reads used during the bid path run on the caller's tx (consistent with
// the FOR UPDATE lock on the auction row).
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { Bid } from '../domain/bid.entity';

export interface HighBid { id: string; amountMinor: bigint; bidderUserId: string; }
export interface BidderFirst { bidderUserId: string; firstAmountMinor: bigint; }

@Injectable()
export class BidRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  async insert(tx: TxContext, b: Bid): Promise<void> {
    const p = b.props;
    await tx.query(
      `INSERT INTO bids (id, tenant_id, auction_id, bidder_user_id, amount_minor, is_sealed, emd_txn_id, ip, device_fingerprint)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [p.id, p.tenantId, p.auctionId, p.bidderUserId, p.amountMinor.toString(), p.isSealed, p.emdTxnId, p.ip, p.deviceFingerprint]);
  }

  /** Current highest bid (read on the auction-lock tx for consistency). Null if no bids. */
  async highest(tx: TxContext, tenantId: string, auctionId: string): Promise<HighBid | null> {
    const r = await tx.query(`SELECT id, amount_minor, bidder_user_id FROM bids WHERE tenant_id=$1 AND auction_id=$2 ORDER BY amount_minor DESC, created_at ASC LIMIT 1`, [tenantId, auctionId]);
    return r.rows[0] ? { id: r.rows[0].id, amountMinor: BigInt(r.rows[0].amount_minor), bidderUserId: r.rows[0].bidder_user_id } : null;
  }

  /** The bidder's first bid's EMD hold txn for this auction (reused on subsequent bids; null if none). */
  async existingEmdTxn(tx: TxContext, tenantId: string, auctionId: string, bidderUserId: string): Promise<string | null> {
    const r = await tx.query<{ emd_txn_id: string }>(`SELECT emd_txn_id FROM bids WHERE tenant_id=$1 AND auction_id=$2 AND bidder_user_id=$3 AND emd_txn_id IS NOT NULL ORDER BY created_at ASC LIMIT 1`, [tenantId, auctionId, bidderUserId]);
    return r.rows[0]?.emd_txn_id ?? null;
  }

  async distinctBidderCount(tx: TxContext, tenantId: string, auctionId: string): Promise<number> {
    const r = await tx.query<{ n: string }>(`SELECT count(DISTINCT bidder_user_id)::text n FROM bids WHERE tenant_id=$1 AND auction_id=$2`, [tenantId, auctionId]);
    return Number(r.rows[0]?.n ?? 0);
  }

  /** Each distinct bidder's FIRST bid amount (drives the EMD amount to release at close). */
  async firstBidAmounts(tx: TxContext, tenantId: string, auctionId: string): Promise<BidderFirst[]> {
    const r = await tx.query(
      `SELECT DISTINCT ON (bidder_user_id) bidder_user_id, amount_minor
         FROM bids WHERE tenant_id=$1 AND auction_id=$2 AND emd_txn_id IS NOT NULL
         ORDER BY bidder_user_id, created_at ASC`, [tenantId, auctionId]);
    return r.rows.map((x) => ({ bidderUserId: x.bidder_user_id, firstAmountMinor: BigInt(x.amount_minor) }));
  }

  /** Bid history for an auction (cursor; sealed bids' amounts are hidden until close by the read-model). */
  async listFor(tenantId: string, auctionId: string, opts: { cursor?: { c: string; id: string }; limit: number }): Promise<Array<{ id: string; bidderUserId: string; amountMinor: string; createdAt: Date }>> {
    const params: unknown[] = [tenantId, auctionId];
    let where = `tenant_id=$1 AND auction_id=$2`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (opts.cursor) { const cc = p(opts.cursor.c), ci = p(opts.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(opts.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT id, bidder_user_id, amount_minor, created_at FROM bids WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map((x) => ({ id: x.id, bidderUserId: x.bidder_user_id, amountMinor: String(x.amount_minor), createdAt: x.created_at }));
  }
}
