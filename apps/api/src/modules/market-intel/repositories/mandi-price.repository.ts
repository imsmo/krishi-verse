// modules/market-intel/repositories/mandi-price.repository.ts · mandi_prices (GLOBAL, PARTITIONED by price_date;
// billions of rows). Append-only observations. Lists are KEYSET on (price_date, id) DESC — never OFFSET — backed
// by idx_mandi_prices_lookup; queries bound product_id (and region/date) so PG prunes partitions (Law 8).
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { MandiPrice } from '../domain/mandi-price.entity';
import { PriceSource } from '../domain/market-intel.events';

const COLS = `id, mandi_id, region_id, product_id, grade_option_id, price_date::text AS price_date, min_minor, max_minor, modal_minor, unit_code, arrivals_qty, source, currency_code`;
function toDomain(r: any): MandiPrice {
  return MandiPrice.rehydrate({ id: String(r.id), mandiId: r.mandi_id, regionId: r.region_id, productId: r.product_id, gradeOptionId: r.grade_option_id, priceDate: r.price_date,
    minMinor: r.min_minor != null ? BigInt(r.min_minor) : null, maxMinor: r.max_minor != null ? BigInt(r.max_minor) : null, modalMinor: BigInt(r.modal_minor),
    unitCode: r.unit_code, arrivalsQty: r.arrivals_qty != null ? String(r.arrivals_qty) : null, source: r.source as PriceSource, currencyCode: r.currency_code });
}
export interface PriceListQuery { productId: string; regionId?: string; mandiId?: string; fromDate?: string; cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class MandiPriceRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async insert(tx: TxContext, m: MandiPrice): Promise<void> {
    const p = m.toProps();
    await tx.query(
      `INSERT INTO mandi_prices (mandi_id, region_id, product_id, grade_option_id, price_date, min_minor, max_minor, modal_minor, unit_code, arrivals_qty, source, currency_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [p.mandiId, p.regionId, p.productId, p.gradeOptionId, p.priceDate, p.minMinor?.toString() ?? null, p.maxMinor?.toString() ?? null, p.modalMinor.toString(), p.unitCode, p.arrivalsQty, p.source, p.currencyCode]);
  }
  /** Latest observation for product (+region/mandi). */
  async latest(tenantId: string, productId: string, regionId: string | null): Promise<MandiPrice | null> {
    const params: unknown[] = [productId]; let where = `product_id=$1`;
    if (regionId) { params.push(regionId); where += ` AND region_id=$2`; }
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM mandi_prices WHERE ${where} ORDER BY price_date DESC, id DESC LIMIT 1`, params);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async listFor(tenantId: string, q: PriceListQuery): Promise<MandiPrice[]> {
    const params: unknown[] = [q.productId]; let where = `product_id=$1`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.regionId) where += ` AND region_id=${p(q.regionId)}`;
    if (q.mandiId) where += ` AND mandi_id=${p(q.mandiId)}`;
    if (q.fromDate) where += ` AND price_date >= ${p(q.fromDate)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (price_date < ${cc} OR (price_date=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM mandi_prices WHERE ${where} ORDER BY price_date DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }
  /** Recent modal observations for the baseline band (bounded window + cap). */
  async recentModals(tenantId: string, productId: string, regionId: string, fromDate: string, max = 500): Promise<bigint[]> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT modal_minor FROM mandi_prices WHERE product_id=$1 AND region_id=$2 AND price_date >= $3 ORDER BY price_date DESC, id DESC LIMIT ${max}`, [productId, regionId, fromDate]);
    return r.rows.map((x: any) => BigInt(x.modal_minor));
  }
}
