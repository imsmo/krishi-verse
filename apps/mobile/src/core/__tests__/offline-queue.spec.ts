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
});
