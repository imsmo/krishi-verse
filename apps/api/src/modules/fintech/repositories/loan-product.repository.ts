// modules/fintech/repositories/loan-product.repository.ts · READ-ONLY loan_products (a partner's catalog).
// GLOBAL reference data (no tenant_id). Money fields read as bigint. Reads on replica.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { LoanProduct } from '../domain/loan-product.entity';

const COLS = `id, partner_id, product_kind_id, default_name, currency_code, min_amount_minor, max_amount_minor, interest_apr_bps, tenure_months_min, tenure_months_max, collateral_kind, repayment_style, is_active, created_at`;
function toDomain(r: any): LoanProduct {
  return LoanProduct.rehydrate({ id: r.id, partnerId: r.partner_id, productKindId: r.product_kind_id, defaultName: r.default_name, currencyCode: r.currency_code,
    minAmountMinor: BigInt(r.min_amount_minor), maxAmountMinor: BigInt(r.max_amount_minor), interestAprBps: r.interest_apr_bps, tenureMonthsMin: r.tenure_months_min, tenureMonthsMax: r.tenure_months_max,
    collateralKind: r.collateral_kind, repaymentStyle: r.repayment_style, isActive: r.is_active, createdAt: r.created_at });
}
@Injectable()
export class LoanProductRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async getById(tenantId: string, id: string, tx?: TxContext): Promise<LoanProduct | null> {
    const sql = `SELECT ${COLS} FROM loan_products WHERE id=$1 AND deleted_at IS NULL`;
    const r = tx ? await tx.query(sql, [id]) : await this.replica.forTenant(tenantId).query(sql, [id]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async list(tenantId: string, q: { partnerId?: string; activeOnly: boolean }): Promise<LoanProduct[]> {
    const params: unknown[] = [];
    let where = `deleted_at IS NULL`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.partnerId) where += ` AND partner_id=${p(q.partnerId)}`;
    if (q.activeOnly) where += ` AND is_active=true`;
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM loan_products WHERE ${where} ORDER BY default_name LIMIT 200`, params);
    return r.rows.map(toDomain);
  }
}
