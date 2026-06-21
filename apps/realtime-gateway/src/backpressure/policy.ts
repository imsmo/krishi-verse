// apps/realtime-gateway/src/backpressure/policy.ts · pure backpressure decisions (§5/§6 — at millions of
// concurrent sockets one slow client must NOT consume the pod's memory). Two bounded limits + a slow-consumer
// rule, all pure so they're unit-tested and identical across pods. The ws-server applies these decisions.

/** Bounded per-socket limits. Defaults are conservative; override via env at the edge. */
export interface BackpressureLimits {
  maxSubscriptions: number;   // channels one socket may hold (anti fan-out abuse)
  maxBufferedBytes: number;   // ws bufferedAmount above which the socket is a slow consumer
  maxQueuedMessages: number;  // our own per-socket outbound queue cap before we evict
}

export const DEFAULT_LIMITS: BackpressureLimits = {
  maxSubscriptions: 50,
  maxBufferedBytes: 1_000_000,   // ~1 MB socket send buffer
  maxQueuedMessages: 100,
};

/** Can this socket take one more subscription? */
export function canAddSubscription(currentCount: number, limits: BackpressureLimits = DEFAULT_LIMITS): boolean {
  return currentCount < limits.maxSubscriptions;
}

/** A laggard: its kernel/ws send buffer or our queue has backed up past the limit. Evict to protect the pod. */
export function isSlowConsumer(
  bufferedBytes: number,
  queuedMessages: number,
  limits: BackpressureLimits = DEFAULT_LIMITS,
): boolean {
  return bufferedBytes > limits.maxBufferedBytes || queuedMessages > limits.maxQueuedMessages;
}

/** Decide what to do with an outbound message for a socket given its current buffer state. */
export type SendDecision = 'send' | 'drop_oldest' | 'evict';

export function decideSend(
  bufferedBytes: number,
  queuedMessages: number,
  limits: BackpressureLimits = DEFAULT_LIMITS,
): SendDecision {
  if (isSlowConsumer(bufferedBytes, queuedMessages, limits)) return 'evict';
  // approaching the queue cap: shed the oldest live update (realtime is "latest wins", staleness is fine)
  if (queuedMessages >= Math.floor(limits.maxQueuedMessages * 0.8)) return 'drop_oldest';
  return 'send';
}
