// modules/catalogue/repositories/brand.repository.ts · READ-ONLY brands (GLOBAL master ref; written in
// apps/admin-api, Law 11). Reads go to the replica (CQRS, Law 12). Keyset pagination on (default_name, id);
// optional trigram name search; parameterised only. byIds batches hydration for product cards (no N+1).
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { Brand } from '../domain/brand.entity';

const COLS = `id, default_name, manufacturer, is_verified, created_at`;
const toBrand = (r: any) => new Brand({ id: r.id, defaultName: r.default_name, manufacturer: r.manufacturer ?? null, isVerified: r.is_verified, createdAt: r.created_at ?? null });

export interface BrandListQuery { q?: string; verifiedOnly: boolean; cursor?: { name: string; id: string }; limit: number; }

@Injectable()
export class BrandRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  async list(tenantId: string, q: BrandListQuery): Promise<Brand[]> {
    const ex = this.replica.forTenant(tenantId);
    const params: unknown[] = []; const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    let where = 'deleted_at IS NULL';
    if (q.verifiedOnly) where += ' AND is_verified';
    if (q.q) where += ` AND default_name ILIKE ${p('%' + q.q + '%')}`;
    if (q.cursor) { const cn = p(q.cursor.name), ci = p(q.cursor.id); where += ` AND (default_name > ${cn} OR (default_name = ${cn} AND id > ${ci}))`; }
    const lp = p(q.limit);
    const r = await ex.query(`SELECT ${COLS} FROM brands WHERE ${where} ORDER BY default_name ASC, id ASC LIMIT ${lp}`, params);
    return r.rows.map(toBrand);
  }

  async getById(tenantId: string, id: string): Promise<Brand | null> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM brands WHERE id = $1 AND deleted_at IS NULL`, [id]);
    return r.rows[0] ? toBrand(r.rows[0]) : null;
  }

  async byIds(tenantId: string, ids: string[]): Promise<Map<string, Brand>> {
    if (ids.length === 0) return new Map();
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM brands WHERE id = ANY($1) AND deleted_at IS NULL`, [ids]);
    const out = new Map<string, Brand>();
    for (const row of r.rows) out.set(row.id, toBrand(row));
    return out;
  }
}
