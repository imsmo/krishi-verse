// modules/orders/repositories/cart.repository.ts · the buyer's active cart + items (tenant-scoped, RLS).
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { uuidv7 } from '../../../core/database/uuid.util';

export interface CartItemRow { id: string; listing_id: string; quantity: string; added_price_minor: string }

@Injectable()
export class CartRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  /** Get-or-create the single active cart for (tenant, user). */
  async getOrCreateActiveId(tx: TxContext, tenantId: string, userId: string): Promise<string> {
    const ins = await tx.query<{ id: string }>(
      // Conflict target MUST match the partial unique index uq_carts_one_active_per_user
      // (0064): the index columns (tenant_id, user_id) PLUS its predicate. Without the
      // WHERE clause Postgres can't match a partial index → "no unique or exclusion
      // constraint matching the ON CONFLICT specification".
      `INSERT INTO carts (id, tenant_id, user_id, status) VALUES ($1,$2,$3,'active')
       ON CONFLICT (tenant_id, user_id) WHERE status = 'active' AND deleted_at IS NULL
       DO UPDATE SET user_id = EXCLUDED.user_id RETURNING id`,
      [uuidv7(), tenantId, userId]);
    return ins.rows[0].id;
  }
  async activeIdForUpdate(tx: TxContext, tenantId: string, userId: string): Promise<string | null> {
    const r = await tx.query<{ id: string }>(`SELECT id FROM carts WHERE tenant_id=$1 AND user_id=$2 AND status='active' FOR UPDATE`, [tenantId, userId]);
    return r.rows[0]?.id ?? null;
  }
  async upsertItem(tx: TxContext, cartId: string, listingId: string, quantity: number, addedPriceMinor: bigint): Promise<void> {
    await tx.query(
      `INSERT INTO cart_items (id, cart_id, listing_id, quantity, added_price_minor) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (cart_id, listing_id) DO UPDATE SET quantity = EXCLUDED.quantity, added_price_minor = EXCLUDED.added_price_minor`,
      [uuidv7(), cartId, listingId, quantity, addedPriceMinor.toString()]);
  }
  async setItemQty(tx: TxContext, cartId: string, listingId: string, quantity: number): Promise<number> {
    const r = await tx.query(`UPDATE cart_items SET quantity=$3 WHERE cart_id=$1 AND listing_id=$2`, [cartId, listingId, quantity]);
    return r.rowCount;
  }
  async removeItem(tx: TxContext, cartId: string, listingId: string): Promise<void> {
    await tx.query(`DELETE FROM cart_items WHERE cart_id=$1 AND listing_id=$2`, [cartId, listingId]);
  }
  async clear(tx: TxContext, cartId: string): Promise<void> { await tx.query(`DELETE FROM cart_items WHERE cart_id=$1`, [cartId]); }
  async markConverted(tx: TxContext, cartId: string): Promise<void> { await tx.query(`UPDATE carts SET status='converted' WHERE id=$1`, [cartId]); }
  async itemsForUpdate(tx: TxContext, cartId: string): Promise<CartItemRow[]> {
    const r = await tx.query<CartItemRow>(`SELECT id, listing_id, quantity, added_price_minor FROM cart_items WHERE cart_id=$1 FOR UPDATE`, [cartId]);
    return r.rows;
  }
  async items(tenantId: string, cartId: string): Promise<CartItemRow[]> {
    const r = await this.replica.forTenant(tenantId).query<CartItemRow>(`SELECT id, listing_id, quantity, added_price_minor FROM cart_items WHERE cart_id=$1 ORDER BY id`, [cartId]);
    return r.rows;
  }
  async activeId(tenantId: string, userId: string): Promise<string | null> {
    const r = await this.replica.forTenant(tenantId).query<{ id: string }>(`SELECT id FROM carts WHERE tenant_id=$1 AND user_id=$2 AND status='active'`, [tenantId, userId]);
    return r.rows[0]?.id ?? null;
  }
}
