// core/database/uuid.util.ts · UUIDv7 generation + timestamp extraction.
// v7 is time-ordered → index-friendly inserts at billions of rows. The
// time-extract enables partition pruning on (id, created_at) PKs (Law 8).
import { randomBytes } from 'crypto';

export function uuidv7(): string {
  const ts = Date.now();
  const b = randomBytes(16);
  b[0] = (ts / 2 ** 40) & 0xff; b[1] = (ts / 2 ** 32) & 0xff; b[2] = (ts / 2 ** 24) & 0xff;
  b[3] = (ts / 2 ** 16) & 0xff; b[4] = (ts / 2 ** 8) & 0xff; b[5] = ts & 0xff;
  b[6] = (b[6] & 0x0f) | 0x70;  // version 7
  b[8] = (b[8] & 0x3f) | 0x80;  // variant
  const h = b.toString('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
/** Extract embedded millisecond timestamp → Date (for partition-pruned lookups). */
export function uuidv7Time(id: string): Date {
  const hex = id.replace(/-/g, '').slice(0, 12);
  return new Date(parseInt(hex, 16));
}
