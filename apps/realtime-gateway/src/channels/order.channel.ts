// apps/realtime-gateway/src/channels/order.channel.ts · a user's PRIVATE order-status timeline.
// Only the owning user may subscribe (enforced in auth/channel-authz.ts). Descriptor + guard only.
import { parseChannel } from './contract';

export const USER_ORDERS_KIND = 'user_orders' as const;

export function isUserOrdersChannel(channel: string): boolean {
  return parseChannel(channel)?.kind === USER_ORDERS_KIND;
}
