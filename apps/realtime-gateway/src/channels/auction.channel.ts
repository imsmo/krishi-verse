// apps/realtime-gateway/src/channels/auction.channel.ts · auction live feed metadata.
// The gateway is content-agnostic (it forwards whatever the publisher projected), so a "channel" here is
// just a small descriptor used for routing/metrics — the authoritative grammar lives in channels/contract.ts
// and authorization in auth/channel-authz.ts. Carries bid updates, extended/ending-soon, closed.
import { parseChannel } from './contract';

export const AUCTION_KIND = 'auction' as const;

/** True if `channel` is an auction live-feed channel. */
export function isAuctionChannel(channel: string): boolean {
  return parseChannel(channel)?.kind === AUCTION_KIND;
}
