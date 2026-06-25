// modules/tenant-webhooks/domain/webhook-events.ts · the curated catalogue of tenant-facing event types a webhook
// endpoint may subscribe to. These map 1:1 to outbox event_types the fanout handler is registered for — a tenant
// can only subscribe to events on this allow-list (anything else is rejected at the DTO). Keep in lockstep with the
// types the WebhookFanoutHandler registers in the module.
export const WEBHOOK_EVENT_TYPES = [
  'order.created',
  'order.completed',
  'order.cancelled',
  'payment.succeeded',
  'payout.completed',
  'shipment.status_changed',
  'auction.ended',
  'offer.accepted',
  'dispute.resolved',
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export function isKnownWebhookEvent(code: string): code is WebhookEventType {
  return (WEBHOOK_EVENT_TYPES as readonly string[]).includes(code);
}
