// modules/schemes/repositories/scheme.repository.ts · READ-ONLY schemes (global catalogue). Money fields
// read as bigint. Reads on replica.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { Scheme } from '../domain/scheme.entity';

const COLS = `id, code, default_name, authority_id, category_id, benefit_summary, eligibility_rules, required_doc_type_ids, application_window, applicable_region_ids, processing_fee_minor, version, is_active, created_at`;
function toDomain(r: any): Scheme {
  return Scheme.rehydrate({ id: r.id, code: r.code, defaultName: r.default_name, authorityId: r.authority_id, categoryId: r.category_id,
    benefitSummary: r.benefit_summary ?? {}, eligibilityRules: r.eligibility_rules ?? {}, requiredDocTypeIds: r.required_doc_type_ids ?? [],
    applicationWindow: r.application_window, applicableRegionIds: r.applicable_region_ids ?? [], processingFeeMinor: BigInt(r.processing_fee_minor), version: r.version, isActive: r.is_active, createdAt: r.created_at });
}
@Injectable()
export class SchemeRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async getById(tenantId: string, id: string, tx?: TxContext): Promise<Scheme | null> {
    const sql = `SELECT ${COLS} FROM schemes WHERE id=$1 AND deleted_at IS NULL`;
    const r = tx ? await tx.query(sql, [id]) : await this.replica.forTenant(tenantId).query(sql, [id]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async list(tenantId: string, q: { categoryId?: string; activeOnly: boolean }): Promise<Scheme[]> {
    const params: unknown[] = []; let where = `deleted_at IS NULL`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.categoryId) where += ` AND category_id=${p(q.categoryId)}`;
    if (q.activeOnly) where += ` AND is_active=true`;
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM schemes WHERE ${where} ORDER BY default_name LIMIT 200`, params);
    return r.rows.map(toDomain);
  }
}
