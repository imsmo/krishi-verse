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
}
