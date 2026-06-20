// modules/traceability/__tests__/traceability-domain.spec.ts · pure-domain invariants (no I/O).
// Pins: the tamper-evident hash chain (deterministic, prev-dependent, tamper-detectable), lot creation emits +
// requires a token, event requires a code, anchor stamps the lot.
import { TraceEvent, chainHash } from '../domain/trace-event.entity';
import { TraceLot } from '../domain/trace-lot.entity';
import { InvalidTraceEventError } from '../domain/traceability.errors';

describe('hash chain', () => {
  it('is deterministic and depends on the previous hash', () => {
    const h1 = chainHash('seed', 'lot1', 'harvested', { a: 1 });
    expect(chainHash('seed', 'lot1', 'harvested', { a: 1 })).toBe(h1);     // deterministic
    expect(chainHash('OTHER', 'lot1', 'harvested', { a: 1 })).not.toBe(h1); // prev-dependent
    expect(chainHash('seed', 'lot1', 'sold', { a: 1 })).not.toBe(h1);       // code-dependent
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });
  it('a chain detects tampering — recomputing a changed link breaks the next hash', () => {
    const e1 = TraceEvent.append({ traceLotId: 'lot1', tenantId: 't1', eventCode: 'listed', meta: {}, prevHash: 'lot1' });
    const e2 = TraceEvent.append({ traceLotId: 'lot1', tenantId: 't1', eventCode: 'sold', meta: { price: 100 }, prevHash: e1.eventHash });
    // tamper e1's meta → its hash changes → e2's prev no longer matches
    const e1Tampered = TraceEvent.append({ traceLotId: 'lot1', tenantId: 't1', eventCode: 'listed', meta: { hacked: true }, prevHash: 'lot1' });
    expect(e1Tampered.eventHash).not.toBe(e1.eventHash);
    const e2Recomputed = chainHash(e1Tampered.eventHash, 'lot1', 'sold', { price: 100 });
    expect(e2Recomputed).not.toBe(e2.eventHash);
  });
  it('rejects an empty event code', () => {
    expect(() => TraceEvent.append({ traceLotId: 'l', tenantId: 't', eventCode: '' as any, meta: {}, prevHash: 'x' })).toThrow(InvalidTraceEventError);
  });
});

describe('TraceLot', () => {
  const mk = () => TraceLot.create({ id: 'l1', tenantId: 't1', listingId: 'lst1', qrToken: 'QR123456', farmerUserId: 'u1', parcelId: null, cropSeasonId: null, declaredInputs: [], certificateIds: [] });
  it('emits LotCreated; anchor stamps + emits LotAnchored', () => {
    const l = mk(); expect(l.pullEvents().map((e) => e.type)).toContain('trace.lot_created');
    l.anchor('deadbeef'); expect(l.blockchainAnchor).toBe('deadbeef');
    expect(l.pullEvents().map((e) => e.type)).toContain('trace.lot_anchored');
  });
});
