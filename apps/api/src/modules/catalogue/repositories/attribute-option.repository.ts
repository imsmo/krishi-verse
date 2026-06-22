// modules/catalogue/repositories/attribute-option.repository.ts · READ-ONLY dropdown options of an attribute
// (GLOBAL master; written in apps/admin-api, Law 11). Replica reads (CQRS). Ordered by (sort_order, code);
// bounded LIMIT. byIds batches the validator path (no N+1).
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { AttributeOption } from '../domain/attribute-option.entity';

const COLS = `id, attribute_id, code, default_name, sort_order, is_active`;
const toOpt = (r: any) => new AttributeOption({ id: r.id, attributeId: r.attribute_id, code: r.code, defaultName: r.default_name, sortOrder: r.sort_order, isActive: r.is_active });
const MAX = 500;

@Injectable()
export class AttributeOptionRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  async listByAttribute(tenantId: string, attributeId: string, activeOnly: boolean): Promise<AttributeOption[]> {
    const ex = this.replica.forTenant(tenantId);
    const where = activeOnly ? 'attribute_id = $1 AND is_active AND deleted_at IS NULL' : 'attribute_id = $1 AND deleted_at IS NULL';
    const r = await ex.query(`SELECT ${COLS} FROM attribute_options WHERE ${where} ORDER BY sort_order ASC, code ASC LIMIT ${MAX}`, [attributeId]);
    return r.rows.map(toOpt);
  }
}
