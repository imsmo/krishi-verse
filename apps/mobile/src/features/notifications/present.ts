// apps/mobile/src/features/notifications/present.ts · PURE presentation helpers for a notification row. The
// rendered title/body live in the server payload (localized); these read them defensively (any shape) and decide
// unread state. No I/O → unit-tested.
import type { NotificationItem } from '@krishi-verse/sdk-js';

export interface PresentedNotification { id: string; title: string; body: string; unread: boolean; createdAt?: string }

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export function presentNotification(n: NotificationItem): PresentedNotification {
  const p = n.payload ?? {};
  const title = str(p.title) || str(p.subject) || n.eventCode;
  const body = str(p.body) || str(p.message) || str(p.text);
  return { id: n.id, title, body, unread: n.status !== 'read', createdAt: n.createdAt };
}

export function unreadCount(items: NotificationItem[]): number {
  return items.reduce((c, n) => c + (n.status !== 'read' ? 1 : 0), 0);
}
