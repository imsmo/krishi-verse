// core/realtime/realtime-publisher.redis.ts
// Redis Pub/Sub adapter for the realtime publisher. Each message is published to a Redis channel that
// matches the gateway's subscription grammar (t:{tenant}:…); the realtime-gateway pods SUBSCRIBE and
// fan each message out to their locally-connected, AUTHORIZED sockets. Wrapped in core/resilience
// (timeout + breaker + bulkhead) with a no-op FALLBACK so a slow/down Redis degrades to "no live update"
// instead of stalling or failing the outbox relay (Law 12). Never throws.
import { Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import type { ResilienceService } from '../resilience/resilience.service';
import type { RealtimePublisher } from './realtime-publisher';
import type { RealtimeMessage } from './realtime-channels';

const DEP = 'realtime-publish';

export class RedisRealtimePublisher implements RealtimePublisher {
  private readonly log = new Logger(RedisRealtimePublisher.name);
  constructor(private readonly client: Redis, private readonly resilience: ResilienceService) {}

  async publish(message: RealtimeMessage): Promise<void> {
    try {
      await this.resilience.run(
        DEP,
        async () => { await this.client.publish(message.channel, JSON.stringify(message)); },
        { fallback: () => undefined },   // degrade: drop the live update, never block the relay
      );
    } catch {
      // resilience already applied the fallback; this is belt-and-suspenders so publish() can never throw
      this.log.debug?.('realtime publish dropped (transport)');
    }
  }
}
