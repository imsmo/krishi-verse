// modules/market-intel/repositories/price-prediction.repository.ts · price_predictions (GLOBAL, PARTITIONED by
// created_at). Append-only fair-price bands. The read returns the most recent band for product+region.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { PricePrediction } from '../domain/price-prediction.entity';

const COLS = `id, product_id, region_id, grade_option_id, target_date::text AS target_date, p10_minor, p50_minor, p90_minor, confidence, model_version, created_at`;
function toDomain(r: any): PricePrediction {
  return PricePrediction.rehydrate({ id: String(r.id), productId: r.product_id, regionId: r.region_id, gradeOptionId: r.grade_option_id, targetDate: r.target_date,
    p10Minor: BigInt(r.p10_minor), p50Minor: BigInt(r.p50_minor), p90Minor: BigInt(r.p90_minor), confidence: r.confidence != null ? Number(r.confidence) : null, modelVersion: r.model_version, createdAt: r.created_at });
}
@Injectable()
export class PricePredictionRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async insert(tx: TxContext, p: PricePrediction): Promise<void> {
    const v = p.toProps();
    await tx.query(`INSERT INTO price_predictions (product_id, region_id, grade_option_id, target_date, p10_minor, p50_minor, p90_minor, confidence, model_version) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [v.productId, v.regionId, v.gradeOptionId, v.targetDate, v.p10Minor.toString(), v.p50Minor.toString(), v.p90Minor.toString(), v.confidence, v.modelVersion]);
  }
  async latest(tenantId: string, productId: string, regionId: string): Promise<PricePrediction | null> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM price_predictions WHERE product_id=$1 AND region_id=$2 ORDER BY created_at DESC, id DESC LIMIT 1`, [productId, regionId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
}
