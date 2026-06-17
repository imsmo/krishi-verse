// core/outbox/__tests__/outbox-dispatcher.spec.ts · the transactional relay (Law 4).
import { OutboxDispatcher, OutboxHandlerRegistry } from '../outbox.dispatcher';
import { OutboxEvent, OutboxHandler } from '../event-envelope';

const noMetrics = { inc: jest.fn(), observe: jest.fn() } as any;

/** A fake pg Pool whose single client returns one pending event, then none. Records queries. */
function fakePool(pendingRows: any[]) {
  const queries: string[] = [];
  let idx = 0;
  const client = {
    query: jest.fn(async (sql: string) => {
      queries.push(sql);
      if (/SELECT id, tenant_id/.test(sql)) {
        const row = pendingRows[idx];
        if (row) { idx++; return { rows: [row], rowCount: 1 }; }
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    }),
    release: jest.fn(),
  };
  const pool = { connect: jest.fn(async () => client), query: jest.fn(async () => ({ rows: [], rowCount: 0 })) };
  return { pool: pool as any, client, queries };
}

const evRow = { id: 7, tenant_id: 't1', aggregate_type: 'payment', aggregate_id: 'p1', event_type: 'payments.payment_succeeded', payload: { referenceType: 'order', referenceId: 'o1' } };

describe('OutboxHandlerRegistry', () => {
  it('registers and looks up handlers by event type', () => {
    const r = new OutboxHandlerRegistry();
    const h: OutboxHandler = { eventType: 'x.y', handle: jest.fn() };
    r.register(h);
    expect(r.handlersFor('x.y')).toEqual([h]);
    expect(r.handlersFor('nope')).toEqual([]);
  });
});

describe('OutboxDispatcher.relayOne', () => {
  it('claims a pending event, invokes the handler, and marks it published (committed)', async () => {
    const registry = new OutboxHandlerRegistry();
    const seen: OutboxEvent[] = [];
    registry.register({ eventType: 'payments.payment_succeeded', handle: async (e) => { seen.push(e); } });
    const { pool, queries } = fakePool([evRow]);
    const ok = await new OutboxDispatcher(pool, registry, noMetrics).relayOne();
    expect(ok).toBe(true);
    expect(seen).toHaveLength(1);
    expect(seen[0].payload.referenceId).toBe('o1');
    expect(queries.some((q) => /BEGIN/.test(q))).toBe(true);
    expect(queries.some((q) => /FOR UPDATE SKIP LOCKED/.test(q))).toBe(true);
    expect(queries.some((q) => /status='published'/.test(q))).toBe(true);
    expect(queries.some((q) => /COMMIT/.test(q))).toBe(true);
  });

  it('returns false when the queue is empty', async () => {
    const { pool } = fakePool([]);
    expect(await new OutboxDispatcher(pool, new OutboxHandlerRegistry(), noMetrics).relayOne()).toBe(false);
  });

  it('a throwing handler rolls back and quarantines the event (failed), never published', async () => {
    const registry = new OutboxHandlerRegistry();
    registry.register({ eventType: 'payments.payment_succeeded', handle: async () => { throw new Error('boom'); } });
    const { pool, client, queries } = fakePool([evRow]);
    const ok = await new OutboxDispatcher(pool, registry, noMetrics).relayOne();
    expect(ok).toBe(true);                      // processed (quarantined)
    expect(queries.some((q) => /ROLLBACK/.test(q))).toBe(true);
    expect(queries.some((q) => /status='published'/.test(q))).toBe(false);
    expect(pool.query).toHaveBeenCalled();      // marked failed in a fresh statement
    expect(client.release).toHaveBeenCalled();
  });
});
