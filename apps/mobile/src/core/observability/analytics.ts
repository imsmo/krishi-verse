// apps/mobile/src/core/observability/analytics.ts · funnel analytics (guide §6 + §4). Events are CONSENTED (off
// until the user opts in), PII-SCRUBBED (every prop runs through redactPII), correlation-tagged, and OFFLINE-
// BUFFERED (a bounded ring buffer that flushes to the provider on reconnect; never grows unbounded, never blocks
// the UI). No money is ever a float (amounts ride as bigint-minor strings if at all — but funnels carry counts,
// not money). The provider (e.g. an analytics SDK) is injected; the default no-op keeps dev/tests/sandbox safe.
import { redactPII } from './redact';
import { currentCorrelationId } from './correlation';

/** The funnel event catalog — the only names the app emits (typo-safe, reviewable, no PII in names). */
export const EVENTS = {
  loginRequested: 'login.otp_requested',
  loginSuccess: 'login.success',
  listingCreateStart: 'listing.create_start',
  listingCreateSuccess: 'listing.create_success',
  checkoutStart: 'checkout.start',
  checkoutSuccess: 'checkout.success',
  payoutRequested: 'payout.requested',
  searchPerformed: 'search.performed',
} as const;
export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

export interface AnalyticsEvent { name: string; props: Record<string, unknown>; ts: number; correlationId: string }
export interface AnalyticsProvider { send(events: AnalyticsEvent[]): Promise<void> }

/** Build a transport-safe event: scrub props, attach the correlation id + timestamp. PURE (now injectable). */
export function buildEvent(name: string, props: Record<string, unknown> = {}, now: number = Date.now()): AnalyticsEvent {
  return { name, props: redactPII(props) as Record<string, unknown>, ts: now, correlationId: currentCorrelationId() };
}

const MAX_BUFFER = 500; // bounded — oldest dropped first (perf §5: never unbounded)
let buffer: AnalyticsEvent[] = [];
let consented = false;
let provider: AnalyticsProvider | null = null;

export function setAnalyticsConsent(on: boolean): void { consented = on; if (!on) buffer = []; }
export function setAnalyticsProvider(p: AnalyticsProvider | null): void { provider = p; }

/** Enqueue an event (no-op without consent). Bounded ring: drops the oldest when full. */
export function track(name: string, props: Record<string, unknown> = {}): void {
  if (!consented) return;
  buffer.push(buildEvent(name, props));
  if (buffer.length > MAX_BUFFER) buffer = buffer.slice(buffer.length - MAX_BUFFER);
}

/** PURE buffer math, unit-tested: append + cap (oldest-out). */
export function appendBounded(buf: AnalyticsEvent[], ev: AnalyticsEvent, max = MAX_BUFFER): AnalyticsEvent[] {
  const next = [...buf, ev];
  return next.length > max ? next.slice(next.length - max) : next;
}

/** Flush the buffer to the provider (called on reconnect/foreground). Best-effort: on failure the events stay
 * buffered for the next attempt (degrade-never-die). No-op without consent/provider. */
export async function flushAnalytics(): Promise<void> {
  if (!consented || !provider || buffer.length === 0) return;
  const batch = buffer;
  buffer = [];
  try { await provider.send(batch); }
  catch { buffer = appendBatchBack(batch, buffer); } // requeue (bounded) on failure
}
function appendBatchBack(batch: AnalyticsEvent[], current: AnalyticsEvent[]): AnalyticsEvent[] {
  const merged = [...batch, ...current];
  return merged.length > MAX_BUFFER ? merged.slice(merged.length - MAX_BUFFER) : merged;
}

/** Test/inspection helper — current buffered count (no event contents leaked). */
export function bufferedCount(): number { return buffer.length; }
