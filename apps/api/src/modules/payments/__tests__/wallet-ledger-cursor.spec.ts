// Unit test for the wallet-ledger keyset cursor helper (the only PURE bit of the read-model). The cursor must
// round-trip through the same base64("<createdAtIso>|<entryId>") scheme the wallet controller decodes, so paging
// is stable. (The read-model's SQL itself is covered by the payments integration suite against real Postgres.)
import { encodeLedgerCursor } from '../read-models/wallet-ledger.read-model';

// mirrors the decode in wallet.controller.ts
const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

describe('wallet-ledger cursor', () => {
  it('round-trips createdAt + entryId through encode → decode', () => {
    const iso = '2026-06-24T10:00:00.000Z';
    const id = '123456';
    const decoded = decodeCursor(encodeLedgerCursor(iso, id));
    expect(decoded).toEqual({ c: iso, id });
  });

  it('produces an opaque, URL-safe-ish base64 token (no raw pipe leaked)', () => {
    const token = encodeLedgerCursor('2026-01-02T03:04:05.000Z', '99');
    expect(token).not.toContain('|');
    expect(Buffer.from(token, 'base64').toString()).toContain('|');
  });
});
