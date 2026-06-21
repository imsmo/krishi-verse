// apps/realtime-gateway/src/pubsub/redis-pubsub.adapter.ts · cross-pod fan-out.
// The api relay publishes each projected message to a Redis channel (t:{tenant}:…). Every gateway pod
// PSUBSCRIBEs to `t:*` and, on each message, hands it to a local dispatcher which forwards it to the
// sockets on THIS pod that are subscribed to that exact channel. This is what makes the pods stateless and
// horizontally scalable: no socket state on the pod, no pod-to-pod coupling — Redis is the bus.
import type Redis from 'ioredis';

export type MessageDispatch = (channel: string, payload: string) => void;

export class RedisPubSubAdapter {
  private started = false;
  // ioredis: a connection in subscriber mode can't run normal commands, so this client is dedicated.
  constructor(private readonly sub: Redis, private readonly dispatch: MessageDispatch) {}

  /** Subscribe to every tenant channel and route incoming messages to local sockets. Idempotent. */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.sub.on('pmessage', (_pattern: string, channel: string, payload: string) => {
      try { this.dispatch(channel, payload); } catch { /* a single bad message must not kill the pod */ }
    });
    await this.sub.psubscribe('t:*');   // all tenant channels; per-pod routing filters to local subscribers
  }

  async stop(): Promise<void> {
    try { await this.sub.punsubscribe('t:*'); } catch { /* shutting down */ }
  }
}
