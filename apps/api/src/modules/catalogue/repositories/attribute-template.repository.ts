// modules/catalogue/repositories/attribute-template.repository.ts · READ-ONLY clonable presets (GLOBAL master;
// written in apps/admin-api, Law 11). Replica reads (CQRS). Keyset on (code, id); optional category/code filter.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { AttributeTemplate } from '../domain/attribute-template.entity';

const COLS = `id, code, default_name, category_id, payload, created_at`;
const toTpl = (r: any) => new AttributeTemplate({ id: r.id, code: r.code, defaultName: r.default_name, categoryId: r.category_id ?? null, payload: r.payload, createdAt: r.created_at ?? null });

export interface TemplateListQuery { categoryId?: string; code?: string; cursor?: { code: string; id: string }; limit: number; }

@Injectable()
export class AttributeTemplateRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  async list(tenantId: string, q: TemplateListQuery): Promise<AttributeTemplate[]> {
    const ex = this.replica.forTenant(tenantId);
    const params: unknown[] = []; const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    let where = 'deleted_at IS NULL';
    if (q.categoryId) where += ` AND category_id = ${p(q.categoryId)}`;
    if (q.code) where += ` AND code = ${p(q.code)}`;
    if (q.cursor) { const cc = p(q.cursor.code), ci = p(q.cursor.id); where += ` AND (code > ${cc} OR (code = ${cc} AND id > ${ci}))`; }
    const lp = p(q.limit);
    const r = await ex.query(`SELECT ${COLS} FROM attribute_templates WHERE ${where} ORDER BY code ASC, id ASC LIMIT ${lp}`, params);
    return r.rows.map(toTpl);
  }

  async getByCode(tenantId: string, code: string): Promise<AttributeTemplate | null> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM attribute_templates WHERE code = $1 AND deleted_at IS NULL`, [code]);
    return r.rows[0] ? toTpl(r.rows[0]) : null;
  }
}
