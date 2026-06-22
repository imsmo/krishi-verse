// modules/payments/repositories/commission-rule.repository.ts
// Resolves the MOST-SPECIFIC effective commission rule for an order. commission_rules is hybrid:
// tenant_id NULL = platform default, set = tenant override (RLS: NULL OR current tenant). Every
// query binds tenant_id (Law 1). Specificity wins: a tenant/category/role/source-specific rule
// beats the platform default; ties broken by `priority` ASC. Effective-dated (effective_from/to).
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { CommissionRuleValues } from '../domain/commission-rule.entity';

export interface ResolvedCommissionRule extends CommissionRuleValues { id: string; }

export interface CommissionQuery { tenantId: string; categoryId: string | null; sellerRoleId: string | null; source: string | null; onDate?: string; }

function toValues(r: any): ResolvedCommissionRule {
  return { id: r.id, rateBps: r.rate_bps, fixedMinor: BigInt(r.fixed_minor), capMinor: r.cap_minor != null ? BigInt(r.cap_minor) : null, platformShareBps: r.platform_share_bps, chargedTo: r.charged_to };
}

// ---- catalog management (tenant overrides only; platform defaults are god-mode in admin-api) ----
export interface CommissionRuleRow {
  id: string; tenantId: string | null; categoryId: string | null; source: string | null; sellerRoleId: string | null;
  rateBps: number; fixedMinor: string; capMinor: string | null; platformShareBps: number; chargedTo: 'seller' | 'buyer';
  priority: number; effectiveFrom: string; effectiveTo: string | null; isActive: boolean; createdAt: Date;
}
const CAT_COLS = `id, tenant_id, category_id, source, seller_role_id, rate_bps, fixed_minor, cap_minor, platform_share_bps, charged_to, priority, effective_from, effective_to, is_active, created_at`;
const ymd = (d: any) => (d instanceof Date ? d.toISOString().slice(0, 10) : (d == null ? d : String(d)));
function toCatalogRow(r: any): CommissionRuleRow {
  return { id: r.id, tenantId: r.tenant_id, categoryId: r.category_id, source: r.source, sellerRoleId: r.seller_role_id,
    rateBps: r.rate_bps, fixedMinor: String(r.fixed_minor), capMinor: r.cap_minor != null ? String(r.cap_minor) : null,
    platformShareBps: r.platform_share_bps, chargedTo: r.charged_to, priority: r.priority,
    effectiveFrom: ymd(r.effective_from), effectiveTo: r.effective_to != null ? ymd(r.effective_to) : null, isActive: r.is_active, createdAt: r.created_at };
}

@Injectable()
export class CommissionRuleRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  /** Resolve within the caller's tx (settlement runs in the relay tx). Binds tenant_id + matches
   *  NULL (= "applies to all") dimensions; most specific first. */
  async resolveBest(tx: TxContext, q: CommissionQuery): Promise<ResolvedCommissionRule | null> {
    const r = await tx.query(
      `SELECT id, rate_bps, fixed_minor, cap_minor, platform_share_bps, charged_to
         FROM commission_rules
        WHERE is_active = true
          AND (tenant_id = $1 OR tenant_id IS NULL)
          AND (category_id = $2 OR category_id IS NULL)
          AND (seller_role_id = $3 OR seller_role_id IS NULL)
          AND (source = $4 OR source IS NULL)
          AND effective_from <= COALESCE($5::date, CURRENT_DATE)
          AND (effective_to IS NULL OR effective_to >= COALESCE($5::date, CURRENT_DATE))
        ORDER BY (tenant_id IS NOT NULL) DESC, (category_id IS NOT NULL) DESC,
                 (seller_role_id IS NOT NULL) DESC, (source IS NOT NULL) DESC, priority ASC
        LIMIT 1`,
      [q.tenantId, q.categoryId, q.sellerRoleId, q.source, q.onDate ?? null]);
    return r.rows[0] ? toValues(r.rows[0]) : null;
  }

  /** Insert a TENANT override (tenant_id is the caller — never NULL; platform defaults are admin-api). */
  async insert(tx: TxContext, r: Omit<CommissionRuleRow, 'createdAt'> & { tenantId: string }): Promise<void> {
    await tx.query(
      `INSERT INTO commission_rules (id, tenant_id, category_id, source, seller_role_id, rate_bps, fixed_minor, cap_minor, platform_share_bps, charged_to, priority, effective_from, effective_to, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::date,$13::date,$14)`,
      [r.id, r.tenantId, r.categoryId, r.source, r.sellerRoleId, r.rateBps, r.fixedMinor, r.capMinor, r.platformShareBps, r.chargedTo, r.priority, r.effectiveFrom, r.effectiveTo, r.isActive]);
  }

  /** Lock a tenant-owned rule for mutation. NULL-tenant (platform) rows are never returned (write-protected here). */
  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<CommissionRuleRow | null> {
    const r = await tx.query(`SELECT ${CAT_COLS} FROM commission_rules WHERE id=$1 AND tenant_id=$2 FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ? toCatalogRow(r.rows[0]) : null;
  }

  async setActive(tx: TxContext, tenantId: string, id: string, isActive: boolean): Promise<number> {
    const r = await tx.query(`UPDATE commission_rules SET is_active=$3, updated_at=now() WHERE id=$1 AND tenant_id=$2`, [id, tenantId, isActive]);
    return r.rowCount ?? 0;
  }

  /** List the tenant's own rules (and, optionally, the inherited platform defaults — read-only). Keyset. */
  async list(tenantId: string, q: { activeOnly: boolean; includePlatformDefaults: boolean; cursor?: { c: string; id: string }; limit: number }): Promise<CommissionRuleRow[]> {
    const params: unknown[] = [tenantId];
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    let where = q.includePlatformDefaults ? `(tenant_id=$1 OR tenant_id IS NULL)` : `tenant_id=$1`;
    if (q.activeOnly) where += ` AND is_active = true`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${CAT_COLS} FROM commission_rules WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toCatalogRow);
  }
}
