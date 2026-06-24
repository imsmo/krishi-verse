// modules/communication/repositories/push-device.repository.ts · the push-token registry (push_devices,
// user-scoped — no tenant_id, mirroring notification_preferences). ALWAYS filtered by user_id (the caller's
// own id) so a user can only ever touch THEIR OWN devices — no IDOR. Writes take the UoW tx; the send-side
// read (activeTokensForUser) is served from the replica.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { PushDevice } from '../domain/push-device.entity';

@Injectable()
export class PushDeviceRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  /** Idempotent (re)register: the token is globally unique, so a repeat re-points it at its latest owner
   *  and re-activates it (reinstall / re-login). One row per token; no duplicates. */
  async upsert(tx: TxContext, d: PushDevice): Promise<void> {
    await tx.query(
      `INSERT INTO push_devices (user_id, platform, token, is_active, last_seen_at)
       VALUES ($1,$2,$3,true,now())
       ON CONFLICT (token) DO UPDATE SET user_id=EXCLUDED.user_id, platform=EXCLUDED.platform, is_active=true, last_seen_at=now(), updated_at=now()`,
      [d.props.userId, d.props.platform, d.props.token]);
  }

  /** Revoke (logout): deactivate the caller's OWN token. Scoped by user_id so a caller can't revoke
   *  someone else's device. Returns the number of rows affected (0 = nothing to do). */
  async deactivate(tx: TxContext, userId: string, token: string): Promise<number> {
    const r = await tx.query(
      `UPDATE push_devices SET is_active=false, updated_at=now() WHERE user_id=$1 AND token=$2 AND is_active=true`,
      [userId, token]);
    return r.rowCount ?? 0;
  }

  /** The caller's active push tokens (send-side targeting). Owner-scoped; never exposes other users'. */
  async activeTokensForUser(userId: string): Promise<{ token: string; platform: string }[]> {
    const r = await this.replica.forTenant('').query<{ token: string; platform: string }>(
      `SELECT token, platform FROM push_devices WHERE user_id=$1 AND is_active=true ORDER BY last_seen_at DESC`,
      [userId]);
    return r.rows;
  }
}
