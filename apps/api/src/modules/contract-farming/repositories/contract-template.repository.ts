// modules/contract-farming/repositories/contract-template.repository.ts · all SQL for contract_templates.
// tenant_id may be NULL (platform-standard, cross-tenant visible per the 0014 RLS policy). Writes tenant-
// scoped; browse includes NULL-tenant. Reads on replica.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { ContractTemplate } from '../domain/contract-template.entity';

const COLS = `id, tenant_id, default_name, category_id, body_template, clauses, is_active, created_at`;
function toDomain(r: any): ContractTemplate {
  return ContractTemplate.rehydrate({ id: r.id, tenantId: r.tenant_id, defaultName: r.default_name, categoryId: r.category_id, bodyTemplate: r.body_template, clauses: r.clauses ?? [], isActive: r.is_active, createdAt: r.created_at });
}
@Injectable()
export class ContractTemplateRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async insert(tx: TxContext, t: ContractTemplate): Promise<void> {
    const p = t.toProps();
    await tx.query(`INSERT INTO contract_templates (id, tenant_id, default_name, category_id, body_template, clauses, is_active, created_by) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,NULL)`,
      [p.id, p.tenantId, p.defaultName, p.categoryId, p.bodyTemplate, JSON.stringify(p.clauses), p.isActive]);
  }
  /** Own OR platform-standard (NULL tenant) template. */
  async getUsable(tenantId: string, id: string, tx?: TxContext): Promise<ContractTemplate | null> {
    const sql = `SELECT ${COLS} FROM contract_templates WHERE id=$1 AND (tenant_id=$2 OR tenant_id IS NULL) AND deleted_at IS NULL`;
    const r = tx ? await tx.query(sql, [id, tenantId]) : await this.replica.forTenant(tenantId).query(sql, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async list(tenantId: string, activeOnly: boolean): Promise<ContractTemplate[]> {
    const r = await this.replica.forTenant(tenantId).query(
      `SELECT ${COLS} FROM contract_templates WHERE (tenant_id=$1 OR tenant_id IS NULL) AND deleted_at IS NULL ${activeOnly ? 'AND is_active=true' : ''} ORDER BY created_at DESC, id DESC LIMIT 200`, [tenantId]);
    return r.rows.map(toDomain);
  }
}
