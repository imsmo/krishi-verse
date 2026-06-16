// modules/identity/repositories/consent.repository.ts · DPDP consent (append-only).
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { Consent } from '../domain/consent.entity';

@Injectable()
export class ConsentRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async record(tx: TxContext, c: Consent): Promise<void> {
    const p = c.props;
    await tx.query(
      `INSERT INTO consents (id, user_id, purpose_code, version, granted, channel, assisted_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [p.id, p.userId, p.purposeCode, p.version, p.granted, p.channel, p.assistedBy]);
  }
  async currentVersion(tenantId: string, purposeCode: string): Promise<string | null> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT current_version FROM consent_purposes WHERE code=$1`, [purposeCode]);
    return r.rows[0]?.current_version ?? null;
  }
  /** Latest consent decision per purpose for a user (DPDP "what am I consented to"). */
  async latestByUser(tenantId: string, userId: string): Promise<any[]> {
    const r = await this.replica.forTenant(tenantId).query(
      `SELECT DISTINCT ON (purpose_code) purpose_code, granted, version, channel, created_at
         FROM consents WHERE user_id=$1 ORDER BY purpose_code, created_at DESC`, [userId]);
    return r.rows;
  }
}
