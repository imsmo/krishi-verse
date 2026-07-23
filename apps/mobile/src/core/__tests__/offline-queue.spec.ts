// Unit tests for the offline write queue. Uses an in-memory KvPort (no AsyncStorage). Covers dedupe by
// idempotency key, sequential replay, transient retry (stops + bumps attempts), permanent-fail dead-lettering,
// and dead-lettering after the attempt cap.
import { OfflineQueue, type KvPort, type ReplayResult } from '../api/offline-queue';

function memKv(): KvPort {
  const m = new Map<string, string>();
  return {
    get: async (k) => (m.has(k) ? m.get(k)! : null),
    set: async (k, v) => { m.set(k, v); },
    remove: async (k) => { m.delete(k); },
  };
}

const op = (i: number) => ({ type: 'listing.create', payload: { i }, idempotencyKey: `idem-${i}`, id: `idem-${i}`, now: i });

describe('OfflineQueue', () => {
  it('enqueues and dedupes by idempotency key', async () => {
    const q = new OfflineQueue(memKv());
    await q.enqueue(op(1));
    await q.enqueue(op(1)); // same key → no duplicate
    await q.enqueue(op(2));
    expect(await q.size()).toBe(2);
  });

  it('flushes all on success, in order', async () => {
    const q = new OfflineQueue(memKv());
    await q.enqueue(op(1)); await q.enqueue(op(2)); await q.enqueue(op(3));
    const seen: number[] = [];
    const res = await q.flush(async (o) => { seen.push((o.payload as { i: number }).i); return 'ok'; });
    expect(res.sent).toBe(3);
    expect(res.remaining).toBe(0);
    expect(seen).toEqual([1, 2, 3]);
  });

  it('stops at the first transient retry and keeps order', async () => {
    const q = new OfflineQueue(memKv());
    await q.enqueue(op(1)); await q.enqueue(op(2));
    const res = await q.flush(async (o) => ((o.payload as { i: number }).i === 1 ? 'retry' : 'ok'));
    expect(res.sent).toBe(0);
    expect(res.remaining).toBe(2);
    const pending = await q.pending();
    expect(pending[0].attempts).toBe(1); // attempt bumped, still at head
  });

  it('dead-letters a permanent failure and continues', async () => {
    const q = new OfflineQueue(memKv());
    await q.enqueue(op(1)); await q.enqueue(op(2));
    const res = await q.flush(async (o) => ((o.payload as { i: number }).i === 1 ? 'permanent-fail' : 'ok'));
    expect(res.dead).toBe(1);
    expect(res.sent).toBe(1);
    expect((await q.dead()).length).toBe(1);
    expect(await q.size()).toBe(0);
  });

  it('dead-letters after exceeding the attempt cap', async () => {
    const q = new OfflineQueue(memKv(), 3); // maxAttempts = 3
    await q.enqueue(op(1));
    const always: ReplayResult = 'retry';
    await q.flush(async () => always); // 1
    await q.flush(async () => always); // 2
    const res = await q.flush(async () => always); // 3 → dead-letter
    expect(res.dead).toBe(1);
    expect(await q.size()).toBe(0);
    expect((await q.dead()).length).toBe(1);
  });

  it('treats a thrown handler as transient', async () => {
    const q = new OfflineQueue(memKv());
    await q.enqueue(op(1));
    const res = await q.flush(async () => { throw new Error('network'); });
    expect(res.remaining).toBe(1);
  });

  // KV-MF-02: a poison op (one that will fail identically forever — a real 4xx/5xx, not a connectivity blip)
  // must (a) drop on the FIRST 'permanent-fail', not linger, and (b) tell the app via `onDropped` so the farmer
  // can be told, instead of the item just vanishing into the dead-letter list unannounced.
  describe('onDropped notification (poison-op handling)', () => {
    it('fires once, with reason "permanent-fail", for an immediate non-network failure', async () => {
      const q = new OfflineQueue(memKv());
      await q.enqueue(op(1)); await q.enqueue(op(2));
      const dropped: Array<{ id: string; reason: string }> = [];
      const res = await q.flush(
        async (o) => ((o.payload as { i: number }).i === 1 ? 'permanent-fail' : 'ok'),
        (o, reason) => dropped.push({ id: o.id, reason }),
      );
      expect(res.dead).toBe(1);
      expect(dropped).toEqual([{ id: 'idem-1', reason: 'permanent-fail' }]);
    });

    it('fires with reason "attempt-cap" once a transient-looking op exhausts maxAttempts', async () => {
      const q = new OfflineQueue(memKv(), 2); // maxAttempts = 2
      await q.enqueue(op(1));
      const dropped: Array<{ reason: string }> = [];
      await q.flush(async () => 'retry', (_o, reason) => dropped.push({ reason })); // attempt 1
      await q.flush(async () => 'retry', (_o, reason) => dropped.push({ reason })); // attempt 2 → cap
      expect(dropped).toEqual([{ reason: 'attempt-cap' }]);
    });

    it('never fires for a plain successful flush', async () => {
      const q = new OfflineQueue(memKv());
      await q.enqueue(op(1));
      const dropped: unknown[] = [];
      await q.flush(async () => 'ok', (o, reason) => dropped.push({ o, reason }));
      expect(dropped).toEqual([]);
    });

    it('a throwing onDropped listener never breaks the drain (defensive — Law 12)', async () => {
      const q = new OfflineQueue(memKv());
      await q.enqueue(op(1)); await q.enqueue(op(2));
      const res = await q.flush(async () => 'permanent-fail', () => { throw new Error('listener bug'); });
      expect(res.dead).toBe(2);
      expect(await q.size()).toBe(0);
    });
  });
});
