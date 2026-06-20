// apps/mobile/src/core/offline/sync-queue.ts · the SINGLE durable offline write queue for the whole app, with a
// handler REGISTRY keyed by op.type. Every feature that enqueues a write (listing.create, media.upload, …)
// registers a replay handler here; `flushQueue()` drains the queue in order, dispatching each op to its handler.
// One queue (not one-per-feature) is required for correct ordering + a single reconnect flush (guide §5/§6).
// An op whose type has no registered handler is treated as transient (waits for the feature to register, then
// the attempt-cap dead-letters it) so a stale op can never silently corrupt another feature.
import { OfflineQueue, type QueuedOp, type OpHandler, type ReplayResult } from '../api/offline-queue';
import { asyncStorageKv } from './kv';

const queue = new OfflineQueue(asyncStorageKv);
const handlers = new Map<string, OpHandler>();

/** Register the replay handler for an op type (idempotent; last registration wins). */
export function registerOpHandler(type: string, handler: OpHandler): void { handlers.set(type, handler); }

/** Enqueue a write op for later replay. Deduped by idempotencyKey inside the queue. */
export function enqueueOp(input: { type: string; payload: unknown; idempotencyKey: string; id: string; now: number }) {
  return queue.enqueue(input);
}

const dispatch: OpHandler = async (op: QueuedOp): Promise<ReplayResult> => {
  const h = handlers.get(op.type);
  if (!h) return 'retry'; // handler not registered yet — wait; attempt-cap will dead-letter a truly orphaned op
  return h(op);
};

/** Drain the queue in order (call on reconnect / app foreground). Safe to call repeatedly. */
export function flushQueue() { return queue.flush(dispatch); }

export function pendingCount() { return queue.size(); }
export function deadOps() { return queue.dead(); }
