// modules/traceability/domain/trace-event.entity.ts · one journey event (trace_events, PARTITIONED by created_at,
// append-only). Tamper-evident HASH CHAIN: event_hash = sha256(prevHash || lotId || eventCode || meta). The first
// event chains off the lot id; each subsequent event chains off the previous event's hash. meta is curated
// non-PII (codes, location text, ids of public artefacts) — it is exposed by the public scan.
import { createHash } from 'node:crypto';
import { TraceStep } from './traceability.events';
import { InvalidTraceEventError } from './traceability.errors';

export interface TraceEventProps {
  id?: string; traceLotId: string; tenantId: string; eventCode: TraceStep; meta: Record<string, unknown>; eventHash: string; createdAt?: Date;
}
/** Deterministic chain hash. prevHash seeds from the lot id for the first event. */
export function chainHash(prevHash: string, lotId: string, eventCode: string, meta: Record<string, unknown>): string {
  return createHash('sha256').update(`${prevHash}|${lotId}|${eventCode}|${JSON.stringify(meta ?? {})}`).digest('hex');
}
export class TraceEvent {
  private constructor(private readonly props: TraceEventProps) {}
  static append(input: { traceLotId: string; tenantId: string; eventCode: TraceStep; meta: Record<string, unknown>; prevHash: string }): TraceEvent {
    if (!input.eventCode) throw new InvalidTraceEventError('eventCode required');
    const eventHash = chainHash(input.prevHash, input.traceLotId, input.eventCode, input.meta);
    return new TraceEvent({ traceLotId: input.traceLotId, tenantId: input.tenantId, eventCode: input.eventCode, meta: input.meta, eventHash });
  }
  static rehydrate(p: TraceEventProps): TraceEvent { return new TraceEvent(p); }
  get eventHash() { return this.props.eventHash; }
  get eventCode() { return this.props.eventCode; }
  toProps(): Readonly<TraceEventProps> { return Object.freeze({ ...this.props }); }
  toJSON() { const v = this.props; return { eventCode: v.eventCode, meta: v.meta, eventHash: v.eventHash, at: v.createdAt }; }
}
