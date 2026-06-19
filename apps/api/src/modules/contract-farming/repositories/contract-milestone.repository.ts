// modules/contract-farming/repositories/contract-milestone.repository.ts · all SQL for contract_milestones.
// tenant_id in EVERY query (Law 1) + RLS. No version column → mutations lock FOR UPDATE. Reads on replica.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { ContractMilestone } from '../domain/contract-milestone.entity';
import { MilestoneType } from '../domain/contract-farming.events';

const COLS = `id, contract_id, grower_id, tenant_id, milestone_type, due_on, completed_at, evidence_media_id, data, created_at`;
const d = (v: any): string | null => (v == null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v));
function toDomain(r: any): ContractMilestone {
  return ContractMilestone.rehydrate({ id: r.id, contractId: r.contract_id, growerId: r.grower_id, tenantId: r.tenant_id, milestoneType: r.milestone_type as MilestoneType, dueOn: d(r.due_on), completedAt: r.completed_at, evidenceMediaId: r.evidence_media_id, data: r.data ?? {}, createdAt: r.created_at });
}
@Injectable()
export class ContractMilestoneRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async insert(tx: TxContext, m: ContractMilestone): Promise<void> {
    const p = m.toProps();
    await tx.query(`INSERT INTO contract_milestones (id, contract_id, grower_id, tenant_id, milestone_type, due_on, completed_at, evidence_media_id, data, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,NULL)`,
      [p.id, p.contractId, p.growerId, p.tenantId, p.milestoneType, p.dueOn, p.completedAt, p.evidenceMediaId, JSON.stringify(p.data)]);
  }
  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<ContractMilestone | null> {
    const r = await tx.query(`SELECT ${COLS} FROM contract_milestones WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async update(tx: TxContext, m: ContractMilestone): Promise<void> {
    const p = m.toProps();
    await tx.query(`UPDATE contract_milestones SET completed_at=$3, evidence_media_id=$4, data=$5::jsonb, updated_at=now() WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`, [p.id, p.tenantId, p.completedAt, p.evidenceMediaId, JSON.stringify(p.data)]);
  }
  async listForContract(tenantId: string, contractId: string): Promise<ContractMilestone[]> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM contract_milestones WHERE tenant_id=$1 AND contract_id=$2 AND deleted_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 500`, [tenantId, contractId]);
    return r.rows.map(toDomain);
  }
}
