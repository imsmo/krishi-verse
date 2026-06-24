// modules/communication/events/handlers/broadcast-requested.handler.ts · consumes communication.broadcast_requested.
// Resolves the broadcast's audience in KEYSET PAGES and fans each page out through the notification spine
// (per-recipient channel resolution + dispatch), then marks the broadcast 'sent'. Runs inside the relay's
// per-event tx with the tenant context set. IDEMPOTENT: a re-delivery finds the broadcast already past 'queued'
// and no-ops; and NotificationService derives a deterministic id from (dedupeKey, user, channel) so re-runs
// never double-send. Money-free.
import { OutboxEvent, OutboxHandler } from '../../../../core/outbox/event-envelope';
import { TxContext } from '../../../../core/database/unit-of-work';
import { BroadcastRepository } from '../../repositories/broadcast.repository';
import { NotificationService } from '../../services/notification.service';
import { BROADCAST_REQUESTED } from '../../services/broadcast.service';

const BROADCAST_EVENT = 'tenant.broadcast';
const PAGE = 500;

export class BroadcastRequestedHandler implements OutboxHandler {
  readonly eventType = BROADCAST_REQUESTED;
  constructor(private readonly broadcasts: BroadcastRepository, private readonly notifications: NotificationService) {}

  async handle(event: OutboxEvent, tx: TxContext): Promise<void> {
    const broadcastId = event.payload.broadcastId as string | undefined;
    if (!event.tenantId || !broadcastId) return;                       // malformed — fail closed
    const b = await this.broadcasts.getForUpdate(tx, event.tenantId, broadcastId);
    if (!b || b.status !== 'queued') return;                           // already processed → idempotent no-op
    b.markSending();
    await this.broadcasts.update(tx, b);

    const { audienceRoleCode, title, body } = b.toProps();
    const payload = { title, body };
    let after: string | null = null;
    let total = 0;
    for (;;) {
      const ids = await this.broadcasts.recipientPage(tx, event.tenantId, audienceRoleCode, after, PAGE);
      if (ids.length === 0) break;
      await this.notifications.fanout(tx, { tenantId: event.tenantId, eventCode: BROADCAST_EVENT, recipients: ids, payload, dedupeKey: `broadcast:${broadcastId}` });
      total += ids.length;
      after = ids[ids.length - 1];
      if (ids.length < PAGE) break;                                    // last page
    }
    b.markSent(total, total);
    await this.broadcasts.update(tx, b);
  }
}
