// modules/communication/repositories/notification-event.repository.ts · the GLOBAL trigger catalog
// (notification_events, no tenant_id → RLS-exempt, read-only here). Codes resolve platform-scoped, never
// from a client id. Reads accept an optional tx so the fanout handler reads on the relay's connection.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { NotificationEvent } from '../domain/notification-event.entity';
import { NotifChannel, NotifPriority } from '../domain/communication.events';

const COLS = `code, default_name, priority, default_channels, user_can_opt_out, batchable`;
function toDomain(r: any): NotificationEvent {
  return NotificationEvent.rehydrate({ code: r.code, defaultName: r.default_name, priority: r.priority as NotifPriority,
    defaultChannels: (r.default_channels ?? []) as NotifChannel[], userCanOptOut: r.user_can_opt_out, batchable: r.batchable });
}

@Injectable()
export class NotificationEventRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async getByCode(code: string, tx?: TxContext): Promise<NotificationEvent | null> {
    const sql = `SELECT ${COLS} FROM notification_events WHERE code=$1 AND deleted_at IS NULL`;
    const r = tx ? await tx.query(sql, [code]) : await this.replica.forTenant('').query(sql, [code]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async list(): Promise<NotificationEvent[]> {
    const r = await this.replica.forTenant('').query(`SELECT ${COLS} FROM notification_events WHERE deleted_at IS NULL ORDER BY code`);
    return r.rows.map(toDomain);
  }
}
