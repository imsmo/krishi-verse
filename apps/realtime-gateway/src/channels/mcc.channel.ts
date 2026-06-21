// apps/realtime-gateway/src/channels/mcc.channel.ts · dairy MCC live collection dashboard (operator-facing).
// Requires the dairy.manage permission to subscribe (enforced in auth/channel-authz.ts). Descriptor + guard.
import { parseChannel } from './contract';

export const MCC_KIND = 'mcc' as const;

export function isMccChannel(channel: string): boolean {
  return parseChannel(channel)?.kind === MCC_KIND;
}
