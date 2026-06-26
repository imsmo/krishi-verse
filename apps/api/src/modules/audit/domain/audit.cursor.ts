// modules/audit/domain/audit.cursor.ts · PURE keyset-cursor codec for the audit trail (no I/O).
// A cursor is an opaque base64 of `<created_at ISO>|<id>`. Decoding is defensive: any malformed
// input yields undefined (treated as "no cursor"), never a throw.
export interface AuditCursor { ts: string; id: string; }

export function encodeAuditCursor(createdAt: string | Date, id: string): string {
  const ts = createdAt instanceof Date ? createdAt.toISOString() : String(createdAt);
  return Buffer.from(`${ts}|${id}`).toString('base64');
}

export function decodeAuditCursor(cursor?: string): AuditCursor | undefined {
  if (!cursor) return undefined;
  try {
    const [ts, id] = Buffer.from(cursor, 'base64').toString().split('|');
    return ts && id ? { ts, id } : undefined;
  } catch {
    return undefined;
  }
}
