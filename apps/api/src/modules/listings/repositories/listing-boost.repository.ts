// modules/listings/repositories/listing-boost.repository.ts
// SQL for paid visibility boosts. Money stored as bigint minor units (Law 1);
// tenant_id on every query; batched expiry uses SKIP LOCKED for multi-pod jobs.
import { Injectable } from '@nestjs/common';
import { TxContext } from '../../../core/database/unit-of-work';
import { ListingBoost } from '../domain/listing-boost.entity';

export interface BoostRow { id: string; listing_id: string; ends_at: Date; }

@Injectable()
export class ListingBoostRepository {
  async insert(tx: TxContext, b: ListingBoost): Promise<void> {
    const p = b.props;
    await tx.query(
      `INSERT INTO listing_boosts
        (id, tenant_id, listing_id, buyer_user_id, boost_tier_id, price_minor, currency_code, payment_txn_id, starts_at, ends_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [p.id, p.tenantId, p.listingId, p.buyerUserId, p.boostTierId, p.priceMinor.toString(),
       p.currencyCode, p.paymentTxnId ?? null, p.startsAt, p.endsAt],
    );
  }

  /** Boosts whose window has closed but not yet ended — locked for this worker. */
  async findExpired(tx: TxContext, tenantId: string, now: Date, limit: number): Promise<{ id: string; listingId: string }[]> {
    const r = await tx.query<BoostRow>(
      `SELECT id, listing_id, ends_at FROM listing_boosts
       WHERE tenant_id=$1 AND ends_at < $2 AND ended_at IS NULL AND deleted_at IS NULL
       ORDER BY ends_at ASC LIMIT $3 FOR UPDATE SKIP LOCKED`,
      [tenantId, now, limit],
    );
    return r.rows.map((x) => ({ id: x.id, listingId: x.listing_id }));
  }

  async markEnded(tx: TxContext, tenantId: string, id: string): Promise<void> {
    await tx.query(
      `UPDATE listing_boosts SET ended_at = now() WHERE id=$1 AND tenant_id=$2 AND ended_at IS NULL`,
      [id, tenantId]);
  }
}
