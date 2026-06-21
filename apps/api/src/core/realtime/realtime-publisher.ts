// core/realtime/realtime-publisher.ts
// The port the fanout handler publishes through. The relay turns a domain event into RealtimeMessages
// (projectEvent) and hands them here; an adapter pushes them to Redis Pub/Sub where the realtime-gateway
// pods are subscribed. Publishing is BEST-EFFORT and must NEVER throw into the relay tx (realtime is
// ephemeral + at-least-once-ish; a Redis blip must not roll back or stall the outbox — Law 12).
import type { RealtimeMessage } from './realtime-channels';

export interface RealtimePublisher {
  /** Publish one message to its channel. Implementations must swallow/raise-nothing on transport failure. */
  publish(message: RealtimeMessage): Promise<void>;
}

export const REALTIME_PUBLISHER = Symbol('REALTIME_PUBLISHER');

/** Default when no REDIS_URL is configured (dev/test/single-pod-no-realtime). A no-op — the platform
 *  works fine without live fan-out; clients fall back to polling. */
export class NoopRealtimePublisher implements RealtimePublisher {
  async publish(_message: RealtimeMessage): Promise<void> { /* intentionally nothing */ }
}
