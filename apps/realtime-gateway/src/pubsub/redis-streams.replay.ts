// apps/realtime-gateway/src/pubsub/redis-streams.replay.ts · missed-message catch-up.
// Pure Pub/Sub is fire-and-forget: a client that reconnects (mobile network flap) misses anything published
// while it was gone. To bridge that gap WITHOUT making the pod stateful, the publisher can ALSO append each
// message to a short, capped Redis Stream per channel (key `s:{channel}`, XADD MAXLEN ~200). On (re)subscribe
// a client may request replay-since-id; we XRANGE the recent tail and replay it, then live Pub/Sub takes over.
// Bounded by design (capped stream + capped read) so replay can't be abused to exfiltrate history or DoS.
import type Redis from 'ioredis';

const MAX_REPLAY = 100;                 // never replay more than this many messages per subscribe (anti-DoS)
const streamKey = (channel: string) => `s:${channel}`;

export class RedisStreamReplay {
  constructor(private readonly client: Redis) {}

  /** Replay up to MAX_REPLAY recent messages for `channel` after `lastId` ('0' = from start of retained tail).
   *  Returns the raw payloads in order. Never throws (replay is best-effort; live feed is the source of truth). */
  async replaySince(channel: string, lastId = '0'): Promise<string[]> {
    try {
      // XRANGE key (lastId, +] — exclusive start via '(' prefix when a real id is given.
      const start = lastId === '0' ? '-' : `(${lastId}`;
      const rows = (await this.client.xrange(streamKey(channel), start, '+', 'COUNT', MAX_REPLAY)) as Array<[string, string[]]>;
      const out: string[] = [];
      for (const [, fields] of rows) {
        // fields = ['m', '<payload>']; tolerate absence
        const i = fields.indexOf('m');
        if (i >= 0 && fields[i + 1]) out.push(fields[i + 1]!);
      }
      return out;
    } catch {
      return [];   // no stream / transient error → no replay; client still gets live updates
    }
  }
}
