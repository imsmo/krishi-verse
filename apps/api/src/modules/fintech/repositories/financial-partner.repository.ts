// modules/fintech/repositories/financial-partner.repository.ts · READ-ONLY financial_partners.
// GLOBAL lender registry (no tenant_id) authored on the admin/platform surface (Law 11). Reads on replica.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { FinancialPartner } from '../domain/financial-partner.entity';

const COLS = `id, code, default_name, partner_kind, regulator_ref, is_active, created_at`;
const toDomain = (r: any) => FinancialPartner.rehydrate({ id: r.id, code: r.code, defaultName: r.default_name, partnerKind: r.partner_kind, regulatorRef: r.regulator_ref, isActive: r.is_active, createdAt: r.created_at });

@Injectable()
export class FinancialPartnerRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async getById(tenantId: string, id: string, tx?: TxContext): Promise<FinancialPartner | null> {
    const sql = `SELECT ${COLS} FROM financial_partners WHERE id=$1 AND deleted_at IS NULL`;
    const r = tx ? await tx.query(sql, [id]) : await this.replica.forTenant(tenantId).query(sql, [id]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async list(tenantId: string, q: { partnerKind?: string; activeOnly: boolean }): Promise<FinancialPartner[]> {
    const params: unknown[] = [];
    let where = `deleted_at IS NULL`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.partnerKind) where += ` AND partner_kind=${p(q.partnerKind)}`;
    if (q.activeOnly) where += ` AND is_active=true`;
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM financial_partners WHERE ${where} ORDER BY default_name LIMIT 200`, params);
    return r.rows.map(toDomain);
  }
}
