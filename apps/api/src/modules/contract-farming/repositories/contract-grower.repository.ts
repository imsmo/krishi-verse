// modules/contract-farming/repositories/contract-grower.repository.ts · all SQL for contract_growers.
// tenant_id in EVERY query (Law 1) + RLS. UNIQUE(contract_id, farmer_user_id, land_parcel_id). Reads on replica.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { ContractGrower } from '../domain/contract-grower.entity';

const COLS = `id, contract_id, tenant_id, farmer_user_id, land_parcel_id, committed_quantity, created_at`;
const toMilli = (v: any): bigint => BigInt(Math.round(Number(v) * 1000));
const milliToNum = (m: bigint) => (Number(m) / 1000).toFixed(3);
function toDomain(r: any): ContractGrower {
  return ContractGrower.rehydrate({ id: r.id, contractId: r.contract_id, tenantId: r.tenant_id, farmerUserId: r.farmer_user_id, landParcelId: r.land_parcel_id, committedQuantityMilli: toMilli(r.committed_quantity), createdAt: r.created_at });
}
@Injectable()
export class ContractGrowerRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async insert(tx: TxContext, g: ContractGrower): Promise<void> {
    const p = g.toProps();
    await tx.query(`INSERT INTO contract_growers (id, contract_id, tenant_id, farmer_user_id, land_parcel_id, committed_quantity, created_by) VALUES ($1,$2,$3,$4,$5,$6,$4)`,
      [p.id, p.contractId, p.tenantId, p.farmerUserId, p.landParcelId, milliToNum(p.committedQuantityMilli)]);
  }
  async getById(tenantId: string, id: string, tx?: TxContext): Promise<ContractGrower | null> {
    const sql = `SELECT ${COLS} FROM contract_growers WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`;
    const r = tx ? await tx.query(sql, [id, tenantId]) : await this.replica.forTenant(tenantId).query(sql, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async listForContract(tenantId: string, contractId: string): Promise<ContractGrower[]> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM contract_growers WHERE tenant_id=$1 AND contract_id=$2 AND deleted_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 500`, [tenantId, contractId]);
    return r.rows.map(toDomain);
  }
}
