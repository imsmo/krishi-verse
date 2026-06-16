// modules/identity/repositories/data-subject-request.repository.ts · DPDP rights requests.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { DataSubjectRequest, DsrProps, DsrStatus, DsrType } from '../domain/data-subject-request.entity';

const COLS = `id, user_id, request_type, status, cooling_ends_at, resolution, export_media_id`;
const toDomain = (r: any): DataSubjectRequest => DataSubjectRequest.rehydrate({ id: r.id, userId: r.user_id, requestType: r.request_type as DsrType, status: r.status as DsrStatus, coolingEndsAt: r.cooling_ends_at, resolution: r.resolution, exportMediaId: r.export_media_id });

@Injectable()
export class DataSubjectRequestRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async insert(tx: TxContext, d: DataSubjectRequest): Promise<void> {
    const p: DsrProps = d.toProps();
    await tx.query(
      `INSERT INTO data_subject_requests (id, user_id, request_type, status, cooling_ends_at) VALUES ($1,$2,$3,$4,$5)`,
      [p.id, p.userId, p.requestType, p.status, p.coolingEndsAt]);
  }
  async listByUser(tenantId: string, userId: string): Promise<DataSubjectRequest[]> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM data_subject_requests WHERE user_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC`, [userId]);
    return r.rows.map(toDomain);
  }
}
