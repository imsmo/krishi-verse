// apps/mobile/src/core/api/offline-queue.ts · the offline-first write queue. On a flaky/absent network, mutations
// (create listing, place bid, …) are ENQUEUED durably and replayed in order when connectivity returns — the
// farmer never loses work mid-field (the core Phase-1 promise). Design notes:
//   • Each op carries a stable idempotency key so a replay can never double-apply server-side (Law 3).
//   • Storage is INJECTED (a tiny get/set/remove KV port), so this class is 100% framework-free and unit-tested
//     (see __tests__/offline-queue.spec.ts). The app wires it to AsyncStorage; tests wire an in-memory map.
//   • Replay is sequential and stops on the first transient failure (keeps order; avoids hammering a down API).
//     A permanent failure (4xx that isn't 408/429) drops the op to a dead-letter list for later inspection.
//   • Bounded: a max attempt count per op; the queue never grows unboundedly from one failing op.

export interface QueuedOp<P = unknown> {
  id: string;
  type: string;              // e.g. 'listing.create' — the app maps this to a handler
  payload: P;
  idempotencyKey: string;
  createdAt: number;
  attempts: number;
}

export interface KvPort {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/** Outcome of attempting one op. `retry` keeps it queued; `permanent-fail` dead-letters it; `ok` removes it. */
export type ReplayResult = 'ok' | 'retry' | 'permanent-fail';
export type OpHandler = (op: QueuedOp) => Promise<ReplayResult>;

const QUEUE_KEY = 'kv.offline.queue';
const DEAD_KEY = 'kv.offline.dead';
const MAX_ATTEMPTS = 8;

export class OfflineQueue {
  constructor(private readonly kv: KvPort, private readonly maxAttempts = MAX_ATTEMPTS) {}

  private async read(key: string): Promise<QueuedOp[]> {
    const raw = await this.kv.get(key);
    if (!raw) return [];
    try { const v = JSON.parse(raw); return Array.isArray(v) ? (v as QueuedOp[]) : []; }
    catch { return []; }   // corrupt store never crashes the app (Law 12)
  }
  private async write(key: string, ops: QueuedOp[]): Promise<void> { await this.kv.set(key, JSON.stringify(ops)); }

  /** Append an op. Deduped by idempotencyKey so a double-tap can't enqueue twice. Returns the queued op. */
  async enqueue<P>(input: { type: string; payload: P; idempotencyKey: string; id: string; now: number }): Promise<QueuedOp<P>> {
    const ops = await this.read(QUEUE_KEY);
    const existing = ops.find((o) => o.idempotencyKey === input.idempotencyKey);
    if (existing) return existing as QueuedOp<P>;
    const op: QueuedOp<P> = { id: input.id, type: input.type, payload: input.payload, idempotencyKey: input.idempotencyKey, createdAt: input.now, attempts: 0 };
    ops.push(op as QueuedOp);
    await this.write(QUEUE_KEY, ops);
    return op;
  }

  async pending(): Promise<QueuedOp[]> { return this.read(QUEUE_KEY); }
  async dead(): Promise<QueuedOp[]> { return this.read(DEAD_KEY); }
  async size(): Promise<number> { return (await this.read(QUEUE_KEY)).length; }

  /** Replay queued ops in order. Stops at the first 'retry' (transient) to preserve ordering and back off.
   * Returns counts. Safe to call repeatedly (e.g. on reconnect / app foreground). */
  async flush(handler: OpHandler): Promise<{ sent: number; dead: number; remaining: number }> {
    let ops = await this.read(QUEUE_KEY);
    let sent = 0; let deadCount = 0;
    while (ops.length > 0) {
      const op = ops[0];
      let result: ReplayResult;
      try { result = await handler(op); }
      catch { result = 'retry'; }   // a throw is treated as transient

      if (result === 'ok') {
        ops = ops.slice(1); sent++;
        await this.write(QUEUE_KEY, ops);
        continue;
      }
      if (result === 'permanent-fail') {
        ops = ops.slice(1); deadCount++;
        await this.write(QUEUE_KEY, ops);
        const dead = await this.read(DEAD_KEY); dead.push(op); await this.write(DEAD_KEY, dead);
        continue;
      }
      // 'retry' — bump attempts; dead-letter if over the cap; otherwise stop and back off.
      const bumped = { ...op, attempts: op.attempts + 1 };
      if (bumped.attempts >= this.maxAttempts) {
        ops = ops.slice(1); deadCount++;
        await this.write(QUEUE_KEY, ops);
        const dead = await this.read(DEAD_KEY); dead.push(bumped); await this.write(DEAD_KEY, dead);
        continue;
      }
      ops = [bumped, ...ops.slice(1)];
      await this.write(QUEUE_KEY, ops);
      break;
    }
    return { sent, dead: deadCount, remaining: ops.length };
  }

  async clear(): Promise<void> { await this.kv.remove(QUEUE_KEY); await this.kv.remove(DEAD_KEY); }
}
