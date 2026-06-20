// modules/market-intel/repositories/price-alert.repository.ts · price_alerts (TENANT-scoped, user-owned) +
// RLS. tenant_id in every query (Law 1). No version → toggles lock FOR UPDATE. matchActive feeds on-ingest
// evaluation (active alerts for a product whose region is unset OR matches). Keyset lists.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { PriceAlert } from '../domain/price-alert.entity';
import { AlertDirection } from '../domain/market-intel.events';

const COLS = `id, tenant_id, user_id, product_id, region_id, direction, threshold_minor, is_active, created_at`;
function toDomain(r: any): PriceAlert {
  return PriceAlert.rehydrate({ id: r.id, tenantId: r.tenant_id, userId: r.user_id, productId: r.product_id, regionId: r.region_id, direction: r.direction as AlertDirection, thresholdMinor: BigInt(r.threshold_minor), isActive: r.is_active, createdAt: r.created_at });
}
export interface AlertListQuery { activeOnly?: boolean; cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class PriceAlertRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async insert(tx: TxContext, a: PriceAlert): Promise<void> {
    const p = a.toProps();
    await tx.query(`INSERT INTO price_alerts (id, tenant_id, user_id, product_id, region_id, direction, threshold_minor, is_active, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$3)`,
      [p.id, p.tenantId, p.userId, p.productId, p.regionId, p.direction, p.thresholdMinor.toString(), p.isActive]);
  }
  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<PriceAlert | null> {
    const r = await tx.query(`SELECT ${COLS} FROM price_alerts WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async update(tx: TxContext, a: PriceAlert): Promise<void> {
    const p = a.toProps();
    await tx.query(`UPDATE price_alerts SET is_active=$3, updated_at=now() WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`, [p.id, p.tenantId, p.isActive]);
  }
  /** Active alerts for a product, region matching (or alert region unset). Bounded — evaluated per ingest. */
  async matchActive(tx: TxContext, tenantId: string, productId: string, regionId: string | null, max = 500): Promise<PriceAlert[]> {
    const params: unknown[] = [tenantId, productId]; let where = `tenant_id=$1 AND product_id=$2 AND is_active=true AND deleted_at IS NULL`;
    if (regionId) { params.push(regionId); where += ` AND (region_id IS NULL OR region_id=$3)`; } else { where += ` AND region_id IS NULL`; }
    const r = await tx.query(`SELECT ${COLS} FROM price_alerts WHERE ${where} ORDER BY created_at LIMIT ${max} FOR UPDATE SKIP LOCKED`, params);
    return r.rows.map(toDomain);
  }
  async listForUser(tenantId: string, userId: string, q: AlertListQuery): Promise<PriceAlert[]> {
    const params: unknown[] = [tenantId, userId]; let where = `tenant_id=$1 AND user_id=$2 AND deleted_at IS NULL`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.activeOnly) where += ` AND is_active=true`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM price_alerts WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }
}
