// modules/catalogue/repositories/category.repository.ts
// Categories are GLOBAL master data (no tenant_id) — read here, managed in admin-api.
// tenant_categories (tenant-scoped, RLS) records which branches a tenant has switched on.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { Category } from '../domain/category.entity';

const COLS = `id, parent_id, code, default_name, path::text AS path, depth, commerce_kind, requires_license, requires_certificate, min_age, is_active, sort_order`;
// Same columns, qualified to the `c` alias for the tree() join. Written out explicitly (not regex-derived from COLS)
// because the `path::text AS path` alias must NOT be prefixed — `AS c.path` is invalid SQL (a syntax error at ".").
const COLS_C = `c.id, c.parent_id, c.code, c.default_name, c.path::text AS path, c.depth, c.commerce_kind, c.requires_license, c.requires_certificate, c.min_age, c.is_active, c.sort_order`;
const toDomain = (r: any): Category => new Category({ id: r.id, parentId: r.parent_id, code: r.code, defaultName: r.default_name, path: r.path, depth: r.depth, commerceKind: r.commerce_kind, requiresLicense: r.requires_license, requiresCertificate: r.requires_certificate, minAge: r.min_age, isActive: r.is_active, sortOrder: r.sort_order });

@Injectable()
export class CategoryRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  async tree(tenantId: string, opts: { activeOnly: boolean; rootCode?: string; parentId?: string; enabledForTenant: boolean }): Promise<Category[]> {
    // Bind params ONLY for clauses actually present. tenantId is used solely by the tenant-categories join, so it
    // must NOT be pre-seeded — an unused $1 makes pg reject the bind ("1 parameter, statement requires 0").
    const params: unknown[] = [];
    const where: string[] = ['c.deleted_at IS NULL'];
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (opts.activeOnly) where.push('c.is_active');
    if (opts.rootCode) where.push(`c.path <@ (SELECT path FROM categories WHERE code = ${p(opts.rootCode)})`);
    if (opts.parentId) where.push(`c.parent_id = ${p(opts.parentId)}`);
    const join = opts.enabledForTenant
      ? `JOIN tenant_categories tc ON tc.category_id = c.id AND tc.tenant_id = ${p(tenantId)} AND tc.is_enabled` : '';
    const r = await this.replica.forTenant(tenantId).query(
      `SELECT ${COLS_C}
         FROM categories c ${join} WHERE ${where.join(' AND ')} ORDER BY c.path LIMIT 2000`, params);
    return r.rows.map(toDomain);
  }

  async byId(tenantId: string, id: string): Promise<Category | null> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM categories WHERE id=$1 AND deleted_at IS NULL`, [id]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async byCode(tenantId: string, code: string): Promise<Category | null> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM categories WHERE code=$1 AND deleted_at IS NULL`, [code]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async existsActive(tenantId: string, id: string): Promise<boolean> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT 1 FROM categories WHERE id=$1 AND is_active AND deleted_at IS NULL`, [id]);
    return r.rowCount! > 0;
  }
  async toggleTenantCategory(tx: TxContext, tenantId: string, categoryId: string, isEnabled: boolean): Promise<void> {
    await tx.query(
      `INSERT INTO tenant_categories (tenant_id, category_id, is_enabled) VALUES ($1,$2,$3)
       ON CONFLICT (tenant_id, category_id) DO UPDATE SET is_enabled = EXCLUDED.is_enabled, updated_at = now()`,
      [tenantId, categoryId, isEnabled]);
  }
}
