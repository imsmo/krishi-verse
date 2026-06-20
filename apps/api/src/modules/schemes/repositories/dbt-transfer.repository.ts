// modules/schemes/repositories/dbt-transfer.repository.ts · all SQL for dbt_transfers (PARTITIONED by
// created_at). tenant_id in EVERY query (Law 1) + RLS. The list bounds created_at so PG prunes partitions
// (Law 8). Append-only observed-credit records.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { DbtTransfer } from '../domain/dbt-transfer.entity';

const COLS = `id, tenant_id, application_id, user_id, scheme_id, amount_minor, instalment_no, credited_on, pfms_ref, created_at`;
const d = (v: any): string => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v));
function toDomain(r: any): DbtTransfer {
  return DbtTransfer.rehydrate({ id: r.id, tenantId: r.tenant_id, applicationId: r.application_id, userId: r.user_id, schemeId: r.scheme_id, amountMinor: BigInt(r.amount_minor), instalmentNo: r.instalment_no, creditedOn: d(r.credited_on), pfmsRef: r.pfms_ref, createdAt: r.created_at });
}
@Injectable()
export class DbtTransferRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async insert(tx: TxContext, t: DbtTransfer): Promise<void> {
    const p = t.toProps();
    await tx.query(`INSERT INTO dbt_transfers (id, tenant_id, application_id, user_id, scheme_id, amount_minor, instalment_no, credited_on, pfms_ref) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [p.id, p.tenantId, p.applicationId, p.userId, p.schemeId, p.amountMinor.toString(), p.instalmentNo, p.creditedOn, p.pfmsRef]);
  }
  async listForApplication(tenantId: string, applicationId: string): Promise<DbtTransfer[]> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM dbt_transfers WHERE tenant_id=$1 AND application_id=$2 AND created_at >= now() - interval '5 years' ORDER BY credited_on DESC, id DESC LIMIT 200`, [tenantId, applicationId]);
    return r.rows.map(toDomain);
  }
}
