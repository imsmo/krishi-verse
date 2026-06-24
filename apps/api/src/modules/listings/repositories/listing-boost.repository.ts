// modules/listings/repositories/listing-boost.repository.ts
// SQL for paid visibility boosts. Money stored as bigint minor units (Law 1);
// tenant_id on every query; batched expiry uses SKIP LOCKED for multi-pod jobs.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { ListingBoost } from '../domain/listing-boost.entity';

export interface BoostRow { id: string; listing_id: string; ends_at: Date; }
/** A selectable boost tier: id to submit + display name + the SERVER-side price/days (from lookup meta). */
export interface BoostTier { id: string; code: string; name: string; priceMinor: string; days: number; }

@Injectable()
export class ListingBoostRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  /** The seeded 'boost_tier' catalogue (price_minor + days live in lookup_values.meta). Platform tiers
   *  (tenant_id NULL) + any tenant overlay; active only. The client shows names + submits a real id. */
  async listTiers(tenantId: string): Promise<BoostTier[]> {
    const r = await this.replica.forTenant(tenantId).query<{ id: string; code: string; default_name: string; meta: any }>(
      `SELECT id, code, default_name, meta FROM lookup_values
        WHERE type_code='boost_tier' AND is_active=true AND (tenant_id IS NULL OR tenant_id=$1)
        ORDER BY sort_order, default_name`,
      [tenantId]);
    return r.rows.map((x) => ({ id: x.id, code: x.code, name: x.default_name, priceMinor: String(x.meta?.price_minor ?? 0), days: Number(x.meta?.days ?? 0) }));
  }

  /** Resolve ONE tier's authoritative price + days (server truth — the client never sends the price). */
  async getTier(tenantId: string, boostTierId: string): Promise<{ priceMinor: bigint; days: number } | null> {
    const r = await this.replica.forTenant(tenantId).query<{ meta: any }>(
      `SELECT meta FROM lookup_values WHERE id=$1 AND type_code='boost_tier' AND is_active=true AND (tenant_id IS NULL OR tenant_id=$2)`,
      [boostTierId, tenantId]);
    const m = r.rows[0]?.meta;
    if (!m || m.price_minor == null || m.days == null) return null;
    return { priceMinor: BigInt(m.price_minor), days: Number(m.days) };
  }

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
