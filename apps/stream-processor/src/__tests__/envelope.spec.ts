import { toEnvelope, serialize, parse, idempotencyKey } from '../envelope';

const row = {
  id: 42, tenant_id: 't1', aggregate_type: 'order', aggregate_id: 'o1',
  event_type: 'orders.order_created', payload: { orderId: 'o1', totalMinor: '250000' },
  created_at: new Date('2026-06-21T00:00:00.000Z'),
};

describe('toEnvelope', () => {
  it('builds a valid envelope from an outbox row', () => {
    const ev = toEnvelope(row);
    expect(ev).toMatchObject({ eventId: 42, tenantId: 't1', eventType: 'orders.order_created', v: 1 });
    expect(ev.occurredAt).toBe('2026-06-21T00:00:00.000Z');
    expect(ev.payload.totalMinor).toBe('250000');   // money stays a string (Law 2)
  });
  it('rejects a structurally-invalid row', () => {
    expect(() => toEnvelope({ ...row, id: 0 })).toThrow();
    expect(() => toEnvelope({ ...row, event_type: 'bad type!' })).toThrow();
  });
  it('tolerates a non-object payload by defaulting to {}', () => {
    expect(toEnvelope({ ...row, payload: null as unknown as Record<string, unknown> }).payload).toEqual({});
  });
});

describe('serialize / parse round-trip', () => {
  it('round-trips a valid event', () => {
    const ev = toEnvelope(row);
    expect(parse(serialize(ev))).toEqual(ev);
  });
  it('parse returns null for malformed/garbage/oversized (→ DLQ)', () => {
    expect(parse('not json')).toBeNull();
    expect(parse('')).toBeNull();
    expect(parse(null)).toBeNull();
    expect(parse(JSON.stringify({ eventId: 0, eventType: 'x.y' }))).toBeNull();        // bad id
    expect(parse(JSON.stringify({ eventId: 5, eventType: 'bad type!' }))).toBeNull();   // bad type
    expect(parse(JSON.stringify({ eventId: 5, eventType: 'a.b', tenantId: 7 }))).toBeNull(); // bad tenant
  });
});

describe('idempotencyKey', () => {
  it('is deterministic per (consumer,event)', () => {
    expect(idempotencyKey('search_indexer', 42)).toBe('search_indexer:42');
  });
});
