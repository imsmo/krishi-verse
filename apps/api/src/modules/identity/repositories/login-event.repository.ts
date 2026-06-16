// modules/identity/repositories/login-event.repository.ts · append-only security trail (partitioned).
import { Injectable } from '@nestjs/common';
import { TxContext } from '../../../core/database/unit-of-work';
import { uuidv7 } from '../../../core/database/uuid.util';

@Injectable()
export class LoginEventRepository {
  async record(tx: TxContext, e: { userId: string | null; phone: string | null; succeeded: boolean; method: string; ip: string | null; deviceFingerprint: string | null }): Promise<void> {
    await tx.query(
      `INSERT INTO login_events (id, user_id, phone, succeeded, method, ip, device_fingerprint)
       VALUES ($1,$2,$3,$4,$5,$6::inet,$7)`,
      [uuidv7(), e.userId, e.phone, e.succeeded, e.method, e.ip, e.deviceFingerprint]);
  }
}
