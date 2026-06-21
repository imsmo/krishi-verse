// apps/stream-processor/src/envelope.ts · the WIRE FORMAT of an event on the bus + a strict parser. PURE,
// dependency-free (so it's unit-tested and shared by producer + consumers without pulling a validation lib in).
// The tailer serializes an outbox row into this envelope; consumers parse it back, FAIL CLOSED on anything
// malformed (a bad message must never crash the consumer — it goes to the DLQ). Bounded sizes guard against a
// hostile/oversized payload. No money math here; amounts inside payload stay strings (Law 2 — never floated).

export interface StreamEvent {
  eventId: number;             // outbox_events.id — globally unique, monotonic; the idempotency anchor
  tenantId: string | null;    // null = platform-scoped event
  aggregateType: string;
  aggregateId: string;
  eventType: string;          // e.g. 'orders.order_created'
  payload: Record<string, unknown>;
  occurredAt: string;         // ISO; from outbox_events.created_at
  v: 1;
}

const MAX_PAYLOAD_BYTES = 256 * 1024;   // 256 KB hard cap — reject pathological messages
const ID_RE = /^[A-Za-z0-9_.:-]{1,120}$/;

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Build an envelope from a tailed outbox row. Throws on a structurally-invalid row (never emit garbage). */
export function toEnvelope(row: {
  id: number | string; tenant_id: string | null; aggregate_type: string; aggregate_id: string;
  event_type: string; payload: unknown; created_at: string | Date;
}): StreamEvent {
  const eventId = Number(row.id);
  if (!Number.isInteger(eventId) || eventId <= 0) throw new Error('envelope: bad event id');
  if (typeof row.event_type !== 'string' || !ID_RE.test(row.event_type)) throw new Error('envelope: bad event_type');
  const payload = isObj(row.payload) ? row.payload : {};
  return {
    eventId,
    tenantId: row.tenant_id ?? null,
    aggregateType: String(row.aggregate_type ?? ''),
    aggregateId: String(row.aggregate_id ?? ''),
    eventType: row.event_type,
    payload,
    occurredAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? ''),
    v: 1,
  };
}

/** Serialize for the broker. */
export function serialize(ev: StreamEvent): string {
  const s = JSON.stringify(ev);
  if (Buffer.byteLength(s, 'utf8') > MAX_PAYLOAD_BYTES) throw new Error('envelope: payload too large');
  return s;
}

/** Parse a broker message back to a validated StreamEvent, or null if malformed (→ caller sends to DLQ). */
export function parse(raw: string | Buffer | null | undefined): StreamEvent | null {
  if (raw == null) return null;
  const buf = typeof raw === 'string' ? raw : raw.toString('utf8');
  if (buf.length === 0 || Buffer.byteLength(buf, 'utf8') > MAX_PAYLOAD_BYTES) return null;
  let o: unknown;
  try { o = JSON.parse(buf); } catch { return null; }
  if (!isObj(o)) return null;
  const eventId = Number((o as Record<string, unknown>).eventId);
  const eventType = (o as Record<string, unknown>).eventType;
  if (!Number.isInteger(eventId) || eventId <= 0) return null;
  if (typeof eventType !== 'string' || !ID_RE.test(eventType)) return null;
  const tenantId = (o as Record<string, unknown>).tenantId;
  if (tenantId !== null && typeof tenantId !== 'string') return null;
  const payload = (o as Record<string, unknown>).payload;
  return {
    eventId,
    tenantId: (tenantId as string | null) ?? null,
    aggregateType: String((o as Record<string, unknown>).aggregateType ?? ''),
    aggregateId: String((o as Record<string, unknown>).aggregateId ?? ''),
    eventType,
    payload: isObj(payload) ? payload : {},
    occurredAt: String((o as Record<string, unknown>).occurredAt ?? ''),
    v: 1,
  };
}

/** Deterministic idempotency key for a (consumer, event) pair — the unique key recorded in
 *  stream_processed_events so redelivery is a no-op. */
export function idempotencyKey(consumer: string, eventId: number): string {
  return `${consumer}:${eventId}`;
}
