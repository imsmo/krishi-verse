// apps/realtime-gateway/src/backpressure/slow-consumer.eviction.ts · applies the pure backpressure policy to
// a live ws socket. A client that can't keep up (its send buffer/queue backs up) is a memory risk at scale —
// we drop the oldest live update as we approach the cap, then EVICT (close 1013 "try again later") if it's
// truly stuck. The decision logic is pure (backpressure/policy.ts) and unit-tested; this just reads the
// socket's bufferedAmount and acts.
import type { WebSocket } from 'ws';
import { decideSend, BackpressureLimits, DEFAULT_LIMITS } from './policy';

const WS_TRY_AGAIN_LATER = 1013;   // RFC 6455 close code for "server overloaded / slow consumer"

/** Send `payload` to `ws`, honoring backpressure. Returns what was done. `queued` is our own per-socket
 *  pending count (the caller tracks it). Never throws. */
export function sendWithBackpressure(
  ws: WebSocket,
  payload: string,
  queued: number,
  limits: BackpressureLimits = DEFAULT_LIMITS,
): 'sent' | 'dropped' | 'evicted' {
  const buffered = (ws as unknown as { bufferedAmount?: number }).bufferedAmount ?? 0;
  const decision = decideSend(buffered, queued, limits);
  if (decision === 'evict') {
    try { ws.close(WS_TRY_AGAIN_LATER, 'slow_consumer'); } catch { /* already closing */ }
    return 'evicted';
  }
  if (decision === 'drop_oldest') return 'dropped';   // caller's queue is near cap; shed this update
  try { ws.send(payload); return 'sent'; } catch { return 'dropped'; }
}
