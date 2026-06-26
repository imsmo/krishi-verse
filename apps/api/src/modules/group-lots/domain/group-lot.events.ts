// modules/group-lots/domain/group-lot.events.ts · integration events published via the outbox (Law 4).
export const GroupLotEventType = {
  Created:   'group_lot.created',
  Pledged:   'group_lot.pledged',
  Ready:     'group_lot.ready',
  Cancelled: 'group_lot.cancelled',
  Settled:   'group_lot.settled',
} as const;
export type DomainEvent = { type: string; payload: Record<string, unknown> };

/** Scale factor for quantity (numeric(14,3) → integer milli-units, float-free). */
export const QTY_SCALE = 1000n;
