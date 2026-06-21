// apps/stream-processor/src/consumers/notification-fanout.consumer.ts · turns domain events into user
// notifications via the external notifier (the scale-out path; apps/api's communication module also fans out
// in-process — both dedup on the same idempotency key so a user is never double-notified). For each event we
// resolve the recipient user id(s) from the payload and dispatch one message per recipient. The notifier dedups
// on `idempotencyKey` = notif:{eventId}:{userId}, so redelivery is a no-op. Degrades to no-op without NOTIFIER_URL.
import type { ConsumerSpec, ConsumerContext } from '../messaging/consumer-runtime';
import type { NotifierClient } from '../downstream/notifier.client';
import { CONSUMER_SUBSCRIPTIONS } from '../topics';
import type { StreamEvent } from '../envelope';

/** Which payload fields name a recipient for a given event, and the channel/eventCode to send. Only events with
 *  a resolvable recipient notify; everything else is ignored (no notification). */
function recipients(ev: StreamEvent): string[] {
  const p = ev.payload;
  const ids: string[] = [];
  for (const key of ['buyerUserId', 'sellerUserId', 'bidderUserId', 'userId', 'recipientUserId']) {
    const v = p[key];
    if (typeof v === 'string' && v.length > 0 && !ids.includes(v)) ids.push(v);
  }
  return ids;
}

export function notificationFanoutConsumer(notifier: NotifierClient): ConsumerSpec {
  const sub = CONSUMER_SUBSCRIPTIONS.notification_fanout;
  return {
    concern: sub.concern,
    groupId: sub.groupId,
    topics: sub.topics,
    async handle(ev: StreamEvent, _ctx: ConsumerContext): Promise<void> {
      if (!notifier.enabled) return;                                 // degrade: api dispatch job still delivers
      const users = recipients(ev);
      if (users.length === 0) return;
      for (const userId of users) {
        await notifier.dispatch({
          idempotencyKey: `notif:${ev.eventId}:${userId}`,           // product dedups → no double-send
          tenantId: ev.tenantId,
          userId,
          channel: 'push',
          eventCode: ev.eventType,
          payload: { aggregateId: ev.aggregateId, ...projectPublic(ev) },
        });
      }
    },
  };
}

/** A NON-PII subset of the payload safe to hand the notifier as structured data (ids/status/amounts-as-string). */
function projectPublic(ev: StreamEvent): Record<string, unknown> {
  const p = ev.payload;
  const out: Record<string, unknown> = {};
  for (const k of ['orderId', 'auctionId', 'status', 'amountMinor', 'currentPriceMinor']) {
    if (typeof p[k] === 'string') out[k] = p[k];
  }
  return out;
}
