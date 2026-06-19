// modules/contract-farming/repositories/input-advance.repository.ts · all SQL for contract_input_advances.
// tenant_id in EVERY query (Law 1) + RLS. value/recovered are bigint minor units. Recovery locks FOR UPDATE.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { InputAdvance } from '../domain/input-advance.entity';

const COLS = `id, contract_id, grower_id, tenant_id, product_id, description, value_minor, recovered_minor, created_at`;
function toDomain(r: any): InputAdvance {
  return InputAdvance.rehydrate({ id: r.id, contractId: r.contract_id, growerId: r.grower_id, tenantId: r.tenant_id, productId: r.product_id, description: r.description, valueMinor: BigInt(r.value_minor), recoveredMinor: BigInt(r.recovered_minor), createdAt: r.created_at });
}
@Injectable()
export class InputAdvanceRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async insert(tx: TxContext, a: InputAdvance): Promise<void> {
    const p = a.toProps();
    await tx.query(`INSERT INTO contract_input_advances (id, contract_id, grower_id, tenant_id, product_id, description, value_minor, recovered_minor, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULL)`,
      [p.id, p.contractId, p.growerId, p.tenantId, p.productId, p.description, p.valueMinor.toString(), p.recoveredMinor.toString()]);
  }
  /** Outstanding (recovered < value) advances for a grower, LOCKED — drives recovery at settlement (oldest first). */
  async listOutstandingForUpdate(tx: TxContext, tenantId: string, growerId: string): Promise<InputAdvance[]> {
    const r = await tx.query(`SELECT ${COLS} FROM contract_input_advances WHERE tenant_id=$1 AND grower_id=$2 AND recovered_minor < value_minor AND deleted_at IS NULL ORDER BY created_at FOR UPDATE`, [tenantId, growerId]);
    return r.rows.map(toDomain);
  }
  async updateRecovered(tx: TxContext, a: InputAdvance): Promise<void> {
    const p = a.toProps();
    await tx.query(`UPDATE contract_input_advances SET recovered_minor=$3, updated_at=now() WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`, [p.id, p.tenantId, p.recoveredMinor.toString()]);
  }
  async listFor(tenantId: string, contractId: string, growerId?: string): Promise<InputAdvance[]> {
    const params: unknown[] = [tenantId, contractId];
    let where = `tenant_id=$1 AND contract_id=$2 AND deleted_at IS NULL`;
    if (growerId) { params.push(growerId); where += ` AND grower_id=$3`; }
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM contract_input_advances WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT 500`, params);
    return r.rows.map(toDomain);
  }
}
