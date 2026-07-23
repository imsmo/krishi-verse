// apps/mobile/src/core/api/offline-queue.ts · the offline-first write queue. On a flaky/absent network, mutations
// (create listing, place bid, …) are ENQUEUED durably and replayed in order when connectivity returns — the
// farmer never loses work mid-field (the core Phase-1 promise). Design notes:
//   • Each op carries a stable idempotency key so a replay can never double-apply server-side (Law 3).
//   • Storage is INJECTED (a tiny get/set/remove KV port), so this class is 100% framework-free and unit-tested
//     (see __tests__/offline-queue.spec.ts). The app wires it to AsyncStorage; tests wire an in-memory map.
//   • Replay is sequential and stops on the first transient failure (keeps order; avoids hammering a down API).
//     A permanent failure (a handler-classified 'permanent-fail' — a real, non-network error that will never
//     resolve on its own, e.g. a validation/4xx or a genuine server bug) drops the op to a dead-letter list
//     immediately, on the FIRST failed attempt — a poison op is never retried "just in case".
//   • Bounded: a max attempt count per op; the queue never grows unboundedly from one failing op.
//   • CLASSIFICATION IS THE HANDLER'S JOB, NOT THE QUEUE'S: a handler must return 'retry' ONLY for TRUE
//     connectivity failures (SdkNetworkError/SdkTimeoutError) — never for a real server response (any status),
//     which must be 'permanent-fail' instead. Getting this wrong is exactly the S6 device bug (KV-MF-02): a real
//     4xx/5xx got queued and misreported to the farmer as "offline", then retried forever because it can never
//     succeed. `onDropped` (below) lets the app surface that loss instead of it vanishing silently.

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
   * Returns counts. Safe to call repeatedly (e.g. on reconnect / app foreground).
   * `onDropped` (optional) fires once per op that leaves the queue WITHOUT succeeding — either an immediate
   * 'permanent-fail' (a non-network error the handler already classified as never-succeeding, e.g. a 422/4xx)
   * or 'attempt-cap' (a 'retry' op that exhausted maxAttempts, e.g. a server outage that never recovered).
   * This is the app's ONE hook to tell the farmer "this saved item could not be sent" instead of silently
   * losing it in the dead-letter list — a poison op must never just vanish (Law 12: degrade-never-die, loudly). */
  async flush(handler: OpHandler, onDropped?: (op: QueuedOp, reason: 'permanent-fail' | 'attempt-cap') => void): Promise<{ sent: number; dead: number; remaining: number }> {
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
        try { onDropped?.(op, 'permanent-fail'); } catch { /* notifier must never break the drain */ }
        continue;
      }
      // 'retry' — bump attempts; dead-letter if over the cap; otherwise stop and back off.
      const bumped = { ...op, attempts: op.attempts + 1 };
      if (bumped.attempts >= this.maxAttempts) {
        ops = ops.slice(1); deadCount++;
        await this.write(QUEUE_KEY, ops);
        const dead = await this.read(DEAD_KEY); dead.push(bumped); await this.write(DEAD_KEY, dead);
        try { onDropped?.(bumped, 'attempt-cap'); } catch { /* notifier must never break the drain */ }
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
