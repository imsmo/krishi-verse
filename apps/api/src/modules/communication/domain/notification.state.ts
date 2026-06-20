// modules/communication/domain/notification.state.ts · STATE MACHINE for notifications.status (Law 5).
// notif_status ENUM = queued|sent|delivered|failed|read|suppressed (db/migrations/0012).
//   queued → sent → delivered → read   (a delivery-status webhook drives sent→delivered)
//   queued → suppressed   (quiet hours / opted-out / disabled channel — never dispatched)
//   queued → failed       (gateway rejected/unavailable; dispatch job retries queued only)
//   failed → queued       (requeue) ; sent/delivered → read (user opened the in-app item)
import { IllegalNotificationTransitionError } from './communication.errors';

export const NOTIF_STATUSES = ['queued', 'sent', 'delivered', 'failed', 'read', 'suppressed'] as const;
export type NotifStatus = (typeof NOTIF_STATUSES)[number];

const TRANSITIONS: Readonly<Record<NotifStatus, readonly NotifStatus[]>> = Object.freeze({
  queued:     ['sent', 'failed', 'suppressed'],
  sent:       ['delivered', 'read', 'failed'],
  delivered:  ['read'],
  failed:     ['queued', 'sent'],
  read:       [],
  suppressed: [],
});
export function canTransition(from: NotifStatus, to: NotifStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: NotifStatus, to: NotifStatus): void { if (!canTransition(from, to)) throw new IllegalNotificationTransitionError(from, to); }
