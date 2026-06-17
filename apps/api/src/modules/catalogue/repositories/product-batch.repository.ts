// modules/catalogue/repositories/product-batch.repository.ts · tenant store inventory (RLS).
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { ProductBatch } from '../domain/product-batch.entity';

const COLS = `id, tenant_id, product_id, seller_user_id, batch_no, mfg_date, expiry_date, mrp_minor, currency_code, qty_received, qty_remaining, unit_code, is_recalled, recall_reason`;
const toDomain = (r: any): ProductBatch => ProductBatch.rehydrate({ id: r.id, tenantId: r.tenant_id, productId: r.product_id, sellerUserId: r.seller_user_id, batchNo: r.batch_no, mfgDate: r.mfg_date, expiryDate: r.expiry_date, mrpMinor: r.mrp_minor != null ? BigInt(r.mrp_minor) : null, currencyCode: r.currency_code, qtyReceived: Number(r.qty_received), qtyRemaining: Number(r.qty_remaining), unitCode: r.unit_code, isRecalled: r.is_recalled, recallReason: r.recall_reason });

@Injectable()
export class ProductBatchRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async insert(tx: TxContext, b: ProductBatch): Promise<void> {
    const v = b.toProps();
    await tx.query(
      `INSERT INTO product_batches (id, tenant_id, product_id, seller_user_id, batch_no, mfg_date, expiry_date, mrp_minor, currency_code, qty_received, qty_remaining, unit_code, is_recalled)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [v.id, v.tenantId, v.productId, v.sellerUserId, v.batchNo, v.mfgDate, v.expiryDate, v.mrpMinor?.toString() ?? null, v.currencyCode, v.qtyReceived, v.qtyRemaining, v.unitCode, v.isRecalled]);
  }
  async update(tx: TxContext, b: ProductBatch): Promise<void> {
    const v = b.toProps();
    await tx.query(
      `UPDATE product_batches SET qty_remaining=$3, is_recalled=$4, recall_reason=$5, updated_at=now()
       WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`,
      [v.id, v.tenantId, v.qtyRemaining, v.isRecalled, v.recallReason]);
  }
  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<ProductBatch | null> {
    const r = await tx.query(`SELECT ${COLS} FROM product_batches WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async list(tenantId: string, opts: { productId?: string; includeExpired: boolean; limit: number }): Promise<ProductBatch[]> {
    const r = await this.replica.forTenant(tenantId).query(
      `SELECT ${COLS} FROM product_batches
        WHERE tenant_id=$1 AND deleted_at IS NULL
          AND ($2::uuid IS NULL OR product_id=$2)
          AND ($3 = true OR expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
        ORDER BY expiry_date NULLS LAST, created_at DESC LIMIT $4`,
      [tenantId, opts.productId ?? null, opts.includeExpired, opts.limit]);
    return r.rows.map(toDomain);
  }
}
