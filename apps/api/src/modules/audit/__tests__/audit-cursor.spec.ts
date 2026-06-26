// modules/audit/__tests__/audit-cursor.spec.ts · pure keyset-cursor codec (no DB).
import { encodeAuditCursor, decodeAuditCursor } from '../domain/audit.cursor';

describe('audit/cursor — opaque keyset codec', () => {
  it('round-trips created_at + id', () => {
    const ts = '2026-06-24T10:00:00.000Z';
    const c = encodeAuditCursor(ts, '12345');
    expect(decodeAuditCursor(c)).toEqual({ ts, id: '12345' });
  });
  it('accepts a Date for created_at', () => {
    const d = new Date('2026-06-24T10:00:00.000Z');
    expect(decodeAuditCursor(encodeAuditCursor(d, '9'))).toEqual({ ts: d.toISOString(), id: '9' });
  });
  it('returns undefined for empty / malformed cursors (never throws)', () => {
    expect(decodeAuditCursor(undefined)).toBeUndefined();
    expect(decodeAuditCursor('')).toBeUndefined();
    expect(decodeAuditCursor(Buffer.from('no-delimiter').toString('base64'))).toBeUndefined();
    expect(decodeAuditCursor('!!!not base64!!!')).toBeUndefined();
  });
});
