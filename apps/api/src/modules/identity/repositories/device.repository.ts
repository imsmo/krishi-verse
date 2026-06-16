// modules/identity/repositories/device.repository.ts · known-device registry (session binding/push).
import { Injectable } from '@nestjs/common';
import { TxContext } from '../../../core/database/unit-of-work';
import { uuidv7 } from '../../../core/database/uuid.util';

@Injectable()
export class DeviceRepository {
  /** Upsert by (user_id, fingerprint); returns the device id. */
  async upsert(tx: TxContext, userId: string, d: { fingerprint: string; platform?: string; model?: string; osVersion?: string; appVersion?: string; pushToken?: string }): Promise<string> {
    const r = await tx.query<{ id: string }>(
      `INSERT INTO devices (id, user_id, fingerprint, platform, model, os_version, app_version, push_token, last_seen_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now())
       ON CONFLICT (user_id, fingerprint) DO UPDATE SET
         platform=EXCLUDED.platform, model=EXCLUDED.model, os_version=EXCLUDED.os_version,
         app_version=EXCLUDED.app_version, push_token=COALESCE(EXCLUDED.push_token, devices.push_token),
         last_seen_at=now(), updated_at=now()
       RETURNING id`,
      [uuidv7(), userId, d.fingerprint, d.platform ?? null, d.model ?? null, d.osVersion ?? null, d.appVersion ?? null, d.pushToken ?? null]);
    return r.rows[0].id;
  }
}
